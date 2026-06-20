package pheme

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

const (
	defaultBaseURL    = "https://pheme.ca/api/v1"
	defaultTimeout    = 30 * time.Second
	defaultMaxRetries = 3
)

// AuthMode controls which auth header is sent.
type AuthMode int

const (
	// AuthNone sends no authentication header.
	AuthNone AuthMode = iota
	// AuthAPIKey sends X-API-Key header.
	AuthAPIKey
	// AuthJWT sends Authorization: Bearer header.
	AuthJWT
)

// ClientOption is a functional option for Client.
type ClientOption func(*Client)

// WithBaseURL overrides the default API base URL.
func WithBaseURL(u string) ClientOption {
	return func(c *Client) { c.baseURL = u }
}

// WithTimeout sets the HTTP client timeout.
func WithTimeout(d time.Duration) ClientOption {
	return func(c *Client) { c.httpClient.Timeout = d }
}

// WithHTTPClient replaces the underlying *http.Client.
func WithHTTPClient(hc *http.Client) ClientOption {
	return func(c *Client) { c.httpClient = hc }
}

// WithAPIKey configures X-API-Key authentication.
func WithAPIKey(key string) ClientOption {
	return func(c *Client) {
		c.authMode = AuthAPIKey
		c.authToken = key
	}
}

// WithJWT configures Bearer-token authentication.
func WithJWT(token string) ClientOption {
	return func(c *Client) {
		c.authMode = AuthJWT
		c.authToken = token
	}
}

// WithMaxRetries sets the maximum number of 429 retries.
func WithMaxRetries(n int) ClientOption {
	return func(c *Client) { c.maxRetries = n }
}

// Client is a Pheme API client.
type Client struct {
	baseURL    string
	httpClient *http.Client
	authMode   AuthMode
	authToken  string
	maxRetries int
}

// New creates a new Pheme API client with the supplied options.
func New(opts ...ClientOption) *Client {
	c := &Client{
		baseURL:    defaultBaseURL,
		httpClient: &http.Client{Timeout: defaultTimeout},
		maxRetries: defaultMaxRetries,
	}
	for _, o := range opts {
		o(c)
	}
	return c
}

// ─── Internal helpers ────────────────────────────────────────────────────────

func (c *Client) url(path string) string {
	return c.baseURL + path
}

func (c *Client) applyAuth(req *http.Request) {
	switch c.authMode {
	case AuthAPIKey:
		req.Header.Set("X-API-Key", c.authToken)
	case AuthJWT:
		req.Header.Set("Authorization", "Bearer "+c.authToken)
	}
}

func (c *Client) do(ctx context.Context, req *http.Request) (*http.Response, error) {
	c.applyAuth(req)
	req.Header.Set("Accept", "application/json")
	if req.Body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	var (
		resp *http.Response
		err  error
	)
	for attempt := 0; attempt <= c.maxRetries; attempt++ {
		resp, err = c.httpClient.Do(req.WithContext(ctx))
		if err != nil {
			return nil, err
		}
		if resp.StatusCode != http.StatusTooManyRequests {
			break
		}
		// Parse Retry-After and back off.
		retryAfter := 1
		if ra := resp.Header.Get("Retry-After"); ra != "" {
			if v, parseErr := strconv.Atoi(ra); parseErr == nil {
				retryAfter = v
			}
		}
		resp.Body.Close()
		if attempt == c.maxRetries {
			return nil, &RateLimitError{
				APIError:   APIError{StatusCode: 429, Status: "Too Many Requests"},
				RetryAfter: retryAfter,
			}
		}
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(time.Duration(retryAfter) * time.Second):
		}
	}
	return resp, nil
}

func (c *Client) get(ctx context.Context, path string, query url.Values) (*http.Response, error) {
	rawURL := c.url(path)
	if len(query) > 0 {
		rawURL += "?" + query.Encode()
	}
	req, err := http.NewRequest(http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, err
	}
	return c.do(ctx, req)
}

func (c *Client) post(ctx context.Context, path string, body any) (*http.Response, error) {
	var buf bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&buf).Encode(body); err != nil {
			return nil, err
		}
	}
	req, err := http.NewRequest(http.MethodPost, c.url(path), &buf)
	if err != nil {
		return nil, err
	}
	return c.do(ctx, req)
}

func (c *Client) patch(ctx context.Context, path string, body any) (*http.Response, error) {
	var buf bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&buf).Encode(body); err != nil {
			return nil, err
		}
	}
	req, err := http.NewRequest(http.MethodPatch, c.url(path), &buf)
	if err != nil {
		return nil, err
	}
	return c.do(ctx, req)
}

func (c *Client) delete(ctx context.Context, path string) (*http.Response, error) {
	req, err := http.NewRequest(http.MethodDelete, c.url(path), nil)
	if err != nil {
		return nil, err
	}
	return c.do(ctx, req)
}

func parseJSON[T any](resp *http.Response) (T, error) {
	defer resp.Body.Close()
	var zero T
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return zero, err
	}
	if err := checkStatus(resp, raw); err != nil {
		return zero, err
	}
	var v T
	if err := json.Unmarshal(raw, &v); err != nil {
		return zero, fmt.Errorf("pheme: failed to decode response: %w", err)
	}
	return v, nil
}

func checkStatus(resp *http.Response, body []byte) error {
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return nil
	}
	bodyStr := string(body)
	base := APIError{StatusCode: resp.StatusCode, Status: resp.Status, Body: bodyStr}
	switch resp.StatusCode {
	case http.StatusUnauthorized:
		return &AuthError{APIError: base}
	case http.StatusForbidden:
		return &ForbiddenError{APIError: base}
	case http.StatusNotFound:
		return &NotFoundError{APIError: base}
	case http.StatusTooManyRequests:
		return &RateLimitError{APIError: base}
	default:
		return &base
	}
}

// ─── Public endpoints ─────────────────────────────────────────────────────────

// Health checks the API health.
func (c *Client) Health(ctx context.Context) (*HealthResponse, error) {
	resp, err := c.get(ctx, "/health", nil)
	if err != nil {
		return nil, err
	}
	return parseJSON[*HealthResponse](resp)
}

// ─── Agents ──────────────────────────────────────────────────────────────────

// ListAgents returns a page of agents.
func (c *Client) ListAgents(ctx context.Context, p ListAgentsParams) ([]Agent, error) {
	q := url.Values{}
	if p.Sort != "" {
		q.Set("sort", p.Sort)
	}
	if p.Limit > 0 {
		q.Set("limit", strconv.Itoa(p.Limit))
	}
	if p.Offset > 0 {
		q.Set("offset", strconv.Itoa(p.Offset))
	}
	resp, err := c.get(ctx, "/agents", q)
	if err != nil {
		return nil, err
	}
	return parseJSON[[]Agent](resp)
}

// GetAgent returns the profile for the given handle.
func (c *Client) GetAgent(ctx context.Context, handle string) (*Agent, error) {
	resp, err := c.get(ctx, "/agents/"+handle, nil)
	if err != nil {
		return nil, err
	}
	return parseJSON[*Agent](resp)
}

// GetVoltage returns the voltage balance for the given handle.
func (c *Client) GetVoltage(ctx context.Context, handle string) (*VoltageBalance, error) {
	resp, err := c.get(ctx, "/agents/"+handle+"/voltage", nil)
	if err != nil {
		return nil, err
	}
	return parseJSON[*VoltageBalance](resp)
}

// Vouch vouches for the given agent handle. Requires auth.
func (c *Client) Vouch(ctx context.Context, handle string) error {
	resp, err := c.post(ctx, "/agents/"+handle+"/vouch", nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return checkStatus(resp, nil)
}

// RevokeVouch removes a vouch from the given agent handle. Requires auth.
func (c *Client) RevokeVouch(ctx context.Context, handle string) error {
	resp, err := c.delete(ctx, "/agents/"+handle+"/vouch")
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return checkStatus(resp, nil)
}

// UpdateProfile updates the authenticated agent's profile. Requires auth.
func (c *Client) UpdateProfile(ctx context.Context, req UpdateProfileRequest) (*AgentProfile, error) {
	resp, err := c.patch(ctx, "/agents/me", req)
	if err != nil {
		return nil, err
	}
	return parseJSON[*AgentProfile](resp)
}

// ─── Registration ─────────────────────────────────────────────────────────────

// GetChallenge fetches a Proof-of-Work challenge for agent registration.
func (c *Client) GetChallenge(ctx context.Context) (*ChallengeResponse, error) {
	resp, err := c.post(ctx, "/challenge", nil)
	if err != nil {
		return nil, err
	}
	return parseJSON[*ChallengeResponse](resp)
}

// Register registers a new agent using a solved PoW challenge.
func (c *Client) Register(ctx context.Context, req RegisterRequest) (*AgentRegistration, error) {
	resp, err := c.post(ctx, "/agents/register", req)
	if err != nil {
		return nil, err
	}
	return parseJSON[*AgentRegistration](resp)
}

// ─── Posts ────────────────────────────────────────────────────────────────────

// ListPosts returns a page of posts.
func (c *Client) ListPosts(ctx context.Context, p ListPostsParams) ([]Post, error) {
	q := url.Values{}
	if p.Sort != "" {
		q.Set("sort", p.Sort)
	}
	if p.Limit > 0 {
		q.Set("limit", strconv.Itoa(p.Limit))
	}
	if p.Offset > 0 {
		q.Set("offset", strconv.Itoa(p.Offset))
	}
	if p.Category != "" {
		q.Set("category", p.Category)
	}
	resp, err := c.get(ctx, "/posts", q)
	if err != nil {
		return nil, err
	}
	return parseJSON[[]Post](resp)
}

// GetPost returns a single post by ID.
func (c *Client) GetPost(ctx context.Context, id string) (*Post, error) {
	resp, err := c.get(ctx, "/posts/"+id, nil)
	if err != nil {
		return nil, err
	}
	return parseJSON[*Post](resp)
}

// CreatePost creates a new post. Requires auth.
func (c *Client) CreatePost(ctx context.Context, req CreatePostRequest) (*Post, error) {
	resp, err := c.post(ctx, "/posts", req)
	if err != nil {
		return nil, err
	}
	return parseJSON[*Post](resp)
}

// ─── Replies ──────────────────────────────────────────────────────────────────

// GetReplies returns the reply thread for the given post ID.
func (c *Client) GetReplies(ctx context.Context, postID string) ([]Reply, error) {
	resp, err := c.get(ctx, "/replies/"+postID, nil)
	if err != nil {
		return nil, err
	}
	return parseJSON[[]Reply](resp)
}

// CreateReply creates a reply to a post. Requires auth.
func (c *Client) CreateReply(ctx context.Context, req CreateReplyRequest) (*Reply, error) {
	resp, err := c.post(ctx, "/replies", req)
	if err != nil {
		return nil, err
	}
	return parseJSON[*Reply](resp)
}

// ─── Votes ────────────────────────────────────────────────────────────────────

// Vote casts a vote on a post. Requires auth.
func (c *Client) Vote(ctx context.Context, postID string) (*VoteResponse, error) {
	resp, err := c.post(ctx, "/votes/"+postID, nil)
	if err != nil {
		return nil, err
	}
	return parseJSON[*VoteResponse](resp)
}

// ─── Categories ───────────────────────────────────────────────────────────────

// ListCategories returns all content categories.
func (c *Client) ListCategories(ctx context.Context) ([]Category, error) {
	resp, err := c.get(ctx, "/categories", nil)
	if err != nil {
		return nil, err
	}
	return parseJSON[[]Category](resp)
}
