package kya

import (
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

// AuthMode controls which authentication header is sent.
type AuthMode int

const (
	// AuthNone sends no authentication header.
	AuthNone AuthMode = iota
	// AuthAPIKey sends an X-API-Key header.
	AuthAPIKey
	// AuthJWT sends an Authorization: Bearer header.
	AuthJWT
)

// ClientOption is a functional option for configuring a Client.
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

// WithJWT configures Bearer-token (JWT) authentication.
func WithJWT(token string) ClientOption {
	return func(c *Client) {
		c.authMode = AuthJWT
		c.authToken = token
	}
}

// WithMaxRetries sets the maximum number of automatic retries on 429 responses.
func WithMaxRetries(n int) ClientOption {
	return func(c *Client) { c.maxRetries = n }
}

// Client is a KYA API client.
type Client struct {
	baseURL    string
	httpClient *http.Client
	authMode   AuthMode
	authToken  string
	maxRetries int
}

// New creates a new KYA API client with the supplied options.
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

// ─── Internal helpers ─────────────────────────────────────────────────────────

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
		retryAfter := 1
		if ra := resp.Header.Get("Retry-After"); ra != "" {
			if v, parseErr := strconv.Atoi(ra); parseErr == nil && v > 0 {
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
		return zero, fmt.Errorf("kya: failed to decode response: %w", err)
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

// ─── KYA endpoints ────────────────────────────────────────────────────────────

// GetScore returns the KYA trust score and dimensional breakdown for the given handle.
func (c *Client) GetScore(ctx context.Context, handle string) (*Score, error) {
	resp, err := c.get(ctx, "/agents/"+handle+"/kya", nil)
	if err != nil {
		return nil, err
	}
	return parseJSON[*Score](resp)
}

// GetCardJSON returns the JSON representation of the agent identity card for the given handle.
func (c *Client) GetCardJSON(ctx context.Context, handle string) (*Card, error) {
	q := url.Values{"format": []string{"json"}}
	resp, err := c.get(ctx, "/agents/"+handle+"/card", q)
	if err != nil {
		return nil, err
	}
	return parseJSON[*Card](resp)
}

// GetCardSVG fetches the SVG identity card for the given handle.
// The caller is responsible for closing the returned io.ReadCloser.
func (c *Client) GetCardSVG(ctx context.Context, handle string) (io.ReadCloser, error) {
	req, err := http.NewRequest(http.MethodGet, c.url("/agents/"+handle+"/card"), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "image/svg+xml")
	resp, err := c.do(ctx, req)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		raw, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, checkStatus(resp, raw)
	}
	return resp.Body, nil
}

// GetBadges returns the list of badges earned by the agent with the given handle.
func (c *Client) GetBadges(ctx context.Context, handle string) ([]Badge, error) {
	resp, err := c.get(ctx, "/agents/"+handle+"/badges", nil)
	if err != nil {
		return nil, err
	}
	return parseJSON[[]Badge](resp)
}

// GetDiscovery fetches the KYA discovery document from /.well-known/kya.json.
func (c *Client) GetDiscovery(ctx context.Context) (*Discovery, error) {
	resp, err := c.get(ctx, "/.well-known/kya.json", nil)
	if err != nil {
		return nil, err
	}
	return parseJSON[*Discovery](resp)
}

// GetCatalog fetches the ARD-compatible agent catalog from /.well-known/ai-catalog.json.
func (c *Client) GetCatalog(ctx context.Context) (*Catalog, error) {
	resp, err := c.get(ctx, "/.well-known/ai-catalog.json", nil)
	if err != nil {
		return nil, err
	}
	return parseJSON[*Catalog](resp)
}
