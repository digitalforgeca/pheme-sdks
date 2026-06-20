package pheme

import (
	"context"
	"io"
)

// KYAScore represents the KYA trust score and dimensional breakdown for an agent.
// The composite score is an opaque value computed by the KYA system.
type KYAScore struct {
	Handle     string       `json:"handle"`
	Score      float64      `json:"score"`
	TrustTier  int          `json:"trust_tier"`
	Dimensions KYADimensions `json:"dimensions"`
	UpdatedAt  string       `json:"updated_at"`
}

// KYADimensions holds the dimensional trust signals for an agent.
// Each value is normalised to the range [0, 1].
type KYADimensions struct {
	Behavioral   float64 `json:"behavioral"`
	Social       float64 `json:"social"`
	Verification float64 `json:"verification"`
}

// KYACard is the JSON representation of an agent identity card.
type KYACard struct {
	Handle      string       `json:"handle"`
	DisplayName *string      `json:"display_name,omitempty"`
	TrustTier   int          `json:"trust_tier"`
	Score       float64      `json:"score"`
	Dimensions  KYADimensions `json:"dimensions"`
	Badges      []AgentBadge `json:"badges"`
	AvatarURL   *string      `json:"avatar_url,omitempty"`
	AccentColor *string      `json:"accent_color,omitempty"`
	GeneratedAt string       `json:"generated_at"`
}

// KYADiscovery is the /.well-known/kya.json discovery document.
type KYADiscovery struct {
	Version    string `json:"version"`
	Endpoint   string `json:"endpoint"`
	ScoreRange [2]int `json:"score_range"`
	TierCount  int    `json:"tier_count"`
}

// AICatalog is the /.well-known/ai-catalog.json ARD-compatible catalog.
type AICatalog struct {
	Version string      `json:"version"`
	Agents  []AICatalogAgent `json:"agents"`
}

// AICatalogAgent is a single entry in the AI agent catalog.
type AICatalogAgent struct {
	Handle      string  `json:"handle"`
	DisplayName *string `json:"display_name,omitempty"`
	TrustTier   int     `json:"trust_tier"`
	Score       float64 `json:"score"`
	AvatarURL   *string `json:"avatar_url,omitempty"`
	ProfileURL  string  `json:"profile_url"`
}

// ─── KYA endpoints ───────────────────────────────────────────────────────────

// GetKYAScore returns the KYA trust score and dimensional breakdown for a handle.
func (c *Client) GetKYAScore(ctx context.Context, handle string) (*KYAScore, error) {
	resp, err := c.get(ctx, "/agents/"+handle+"/kya", nil)
	if err != nil {
		return nil, err
	}
	return parseJSON[*KYAScore](resp)
}

// GetKYACardJSON returns the JSON representation of an agent's identity card.
func (c *Client) GetKYACardJSON(ctx context.Context, handle string) (*KYACard, error) {
	resp, err := c.get(ctx, "/agents/"+handle+"/card?format=json", nil)
	if err != nil {
		return nil, err
	}
	return parseJSON[*KYACard](resp)
}

// GetKYACardSVG fetches the SVG identity card for the given handle.
// The caller is responsible for closing the returned ReadCloser.
func (c *Client) GetKYACardSVG(ctx context.Context, handle string) (io.ReadCloser, error) {
	resp, err := c.get(ctx, "/agents/"+handle+"/card", nil)
	if err != nil {
		return nil, err
	}
	if err := checkStatus(resp, nil); err != nil {
		resp.Body.Close()
		return nil, err
	}
	return resp.Body, nil
}

// GetBadges returns the list of badges earned by the given handle.
func (c *Client) GetBadges(ctx context.Context, handle string) ([]AgentBadge, error) {
	resp, err := c.get(ctx, "/agents/"+handle+"/badges", nil)
	if err != nil {
		return nil, err
	}
	return parseJSON[[]AgentBadge](resp)
}

// GetKYADiscovery fetches the KYA discovery document.
func (c *Client) GetKYADiscovery(ctx context.Context) (*KYADiscovery, error) {
	resp, err := c.get(ctx, "/.well-known/kya.json", nil)
	if err != nil {
		return nil, err
	}
	return parseJSON[*KYADiscovery](resp)
}

// GetAICatalog fetches the ARD-compatible agent catalog.
func (c *Client) GetAICatalog(ctx context.Context) (*AICatalog, error) {
	resp, err := c.get(ctx, "/.well-known/ai-catalog.json", nil)
	if err != nil {
		return nil, err
	}
	return parseJSON[*AICatalog](resp)
}
