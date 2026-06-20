package kya

// Score represents the KYA trust score and dimensional breakdown for an agent.
// The composite score is an opaque value produced by the KYA system.
type Score struct {
	Handle    string     `json:"handle"`
	Score     float64    `json:"score"`
	TrustTier int        `json:"trust_tier"`
	Dimensions Dimensions `json:"dimensions"`
	UpdatedAt string     `json:"updated_at"`
}

// Dimensions holds the dimensional trust signals for an agent.
// Each value is normalised to the range [0, 1].
type Dimensions struct {
	Behavioral   float64 `json:"behavioral"`
	Social       float64 `json:"social"`
	Verification float64 `json:"verification"`
}

// Card is the JSON representation of an agent identity card.
type Card struct {
	Handle      string     `json:"handle"`
	DisplayName *string    `json:"display_name,omitempty"`
	TrustTier   int        `json:"trust_tier"`
	Score       float64    `json:"score"`
	Dimensions  Dimensions `json:"dimensions"`
	Badges      []Badge    `json:"badges"`
	AvatarURL   *string    `json:"avatar_url,omitempty"`
	AccentColor *string    `json:"accent_color,omitempty"`
	GeneratedAt string     `json:"generated_at"`
}

// Badge represents a badge earned by an agent.
type Badge struct {
	ID            string  `json:"id"`
	BadgeID       string  `json:"badge_id"`
	Slug          string  `json:"slug"`
	Name          string  `json:"name"`
	Description   string  `json:"description"`
	IconURL       *string `json:"icon_url,omitempty"`
	VoltageReward int     `json:"voltage_reward"`
	AwardedAt     string  `json:"awarded_at"`
}

// Discovery is the /.well-known/kya.json discovery document.
type Discovery struct {
	Version    string `json:"version"`
	Endpoint   string `json:"endpoint"`
	ScoreRange [2]int `json:"score_range"`
	TierCount  int    `json:"tier_count"`
}

// CatalogEntry is a single entry in the AI agent catalog.
type CatalogEntry struct {
	Handle      string  `json:"handle"`
	DisplayName *string `json:"display_name,omitempty"`
	TrustTier   int     `json:"trust_tier"`
	Score       float64 `json:"score"`
	AvatarURL   *string `json:"avatar_url,omitempty"`
	ProfileURL  string  `json:"profile_url"`
}

// Catalog is the /.well-known/ai-catalog.json ARD-compatible catalog.
type Catalog struct {
	Version string         `json:"version"`
	Agents  []CatalogEntry `json:"agents"`
}
