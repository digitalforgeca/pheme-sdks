package kya_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/digitalforgeca/kya-sdk-go/kya"
)

// newTestClient returns a Client pointed at the given test server.
func newTestClient(srv *httptest.Server) *kya.Client {
	return kya.New(
		kya.WithBaseURL(srv.URL),
		kya.WithHTTPClient(srv.Client()),
		kya.WithAPIKey("phm_your_api_key_here"),
	)
}

func TestGetScore(t *testing.T) {
	want := kya.Score{
		Handle:    "test-agent",
		Score:     0.75,
		TrustTier: 2,
		Dimensions: kya.Dimensions{
			Behavioral:   0.8,
			Social:       0.7,
			Verification: 0.75,
		},
		UpdatedAt: "2026-01-01T00:00:00Z",
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/agents/test-agent/kya" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if r.Header.Get("X-API-Key") != "phm_your_api_key_here" {
			t.Errorf("missing or wrong X-API-Key header")
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(want)
	}))
	defer srv.Close()

	client := newTestClient(srv)
	got, err := client.GetScore(context.Background(), "test-agent")
	if err != nil {
		t.Fatalf("GetScore: %v", err)
	}
	if got.Handle != want.Handle {
		t.Errorf("handle: got %q, want %q", got.Handle, want.Handle)
	}
	if got.Score != want.Score {
		t.Errorf("score: got %v, want %v", got.Score, want.Score)
	}
	if got.TrustTier != want.TrustTier {
		t.Errorf("trust_tier: got %d, want %d", got.TrustTier, want.TrustTier)
	}
	if got.Dimensions.Behavioral != want.Dimensions.Behavioral {
		t.Errorf("behavioral: got %v, want %v", got.Dimensions.Behavioral, want.Dimensions.Behavioral)
	}
}

func TestGetCardJSON(t *testing.T) {
	displayName := "Test Agent"
	want := kya.Card{
		Handle:      "test-agent",
		DisplayName: &displayName,
		TrustTier:   3,
		Score:       0.85,
		Dimensions: kya.Dimensions{
			Behavioral:   0.9,
			Social:       0.8,
			Verification: 0.85,
		},
		Badges:      []kya.Badge{},
		GeneratedAt: "2026-01-01T00:00:00Z",
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/agents/test-agent/card" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if r.URL.Query().Get("format") != "json" {
			t.Errorf("expected format=json query param")
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(want)
	}))
	defer srv.Close()

	client := newTestClient(srv)
	got, err := client.GetCardJSON(context.Background(), "test-agent")
	if err != nil {
		t.Fatalf("GetCardJSON: %v", err)
	}
	if got.Handle != want.Handle {
		t.Errorf("handle: got %q, want %q", got.Handle, want.Handle)
	}
	if got.TrustTier != want.TrustTier {
		t.Errorf("trust_tier: got %d, want %d", got.TrustTier, want.TrustTier)
	}
}

func TestGetBadges(t *testing.T) {
	iconURL := "https://pheme.ca/badges/pioneer.svg"
	want := []kya.Badge{
		{
			ID:            "b1",
			BadgeID:       "pioneer",
			Slug:          "pioneer",
			Name:          "Pioneer",
			Description:   "Early adopter",
			IconURL:       &iconURL,
			VoltageReward: 100,
			AwardedAt:     "2026-01-01T00:00:00Z",
		},
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/agents/test-agent/badges" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(want)
	}))
	defer srv.Close()

	client := newTestClient(srv)
	got, err := client.GetBadges(context.Background(), "test-agent")
	if err != nil {
		t.Fatalf("GetBadges: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("expected 1 badge, got %d", len(got))
	}
	if got[0].Slug != "pioneer" {
		t.Errorf("badge slug: got %q, want %q", got[0].Slug, "pioneer")
	}
}

func TestGetDiscovery(t *testing.T) {
	want := kya.Discovery{
		Version:    "1.0",
		Endpoint:   "https://pheme.ca/api/v1",
		ScoreRange: [2]int{0, 100},
		TierCount:  5,
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/.well-known/kya.json" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(want)
	}))
	defer srv.Close()

	client := newTestClient(srv)
	got, err := client.GetDiscovery(context.Background())
	if err != nil {
		t.Fatalf("GetDiscovery: %v", err)
	}
	if got.Version != want.Version {
		t.Errorf("version: got %q, want %q", got.Version, want.Version)
	}
	if got.TierCount != want.TierCount {
		t.Errorf("tier_count: got %d, want %d", got.TierCount, want.TierCount)
	}
}

func TestGetCatalog(t *testing.T) {
	displayName := "Catalog Agent"
	want := kya.Catalog{
		Version: "1.0",
		Agents: []kya.CatalogEntry{
			{
				Handle:      "catalog-agent",
				DisplayName: &displayName,
				TrustTier:   4,
				Score:       0.9,
				ProfileURL:  "https://pheme.ca/agent/catalog-agent",
			},
		},
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/.well-known/ai-catalog.json" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(want)
	}))
	defer srv.Close()

	client := newTestClient(srv)
	got, err := client.GetCatalog(context.Background())
	if err != nil {
		t.Fatalf("GetCatalog: %v", err)
	}
	if len(got.Agents) != 1 {
		t.Fatalf("expected 1 agent, got %d", len(got.Agents))
	}
}

func TestRateLimitRetry(t *testing.T) {
	attempts := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts++
		if attempts < 3 {
			w.Header().Set("Retry-After", "0")
			w.WriteHeader(http.StatusTooManyRequests)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(kya.Score{Handle: "x", UpdatedAt: "2026-01-01T00:00:00Z"})
	}))
	defer srv.Close()

	client := kya.New(
		kya.WithBaseURL(srv.URL),
		kya.WithHTTPClient(srv.Client()),
		kya.WithMaxRetries(3),
		kya.WithTimeout(5*time.Second),
	)
	_, err := client.GetScore(context.Background(), "x")
	if err != nil {
		t.Fatalf("expected success after retries, got: %v", err)
	}
	if attempts < 3 {
		t.Errorf("expected at least 3 attempts, got %d", attempts)
	}
}

func TestNotFoundError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer srv.Close()

	client := newTestClient(srv)
	_, err := client.GetScore(context.Background(), "no-such-agent")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	nfe, ok := err.(*kya.NotFoundError)
	if !ok {
		t.Fatalf("expected *kya.NotFoundError, got %T: %v", err, err)
	}
	if nfe.StatusCode != 404 {
		t.Errorf("status code: got %d, want 404", nfe.StatusCode)
	}
}

func TestAuthError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer srv.Close()

	client := kya.New(
		kya.WithBaseURL(srv.URL),
		kya.WithHTTPClient(srv.Client()),
	)
	_, err := client.GetScore(context.Background(), "agent")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if _, ok := err.(*kya.AuthError); !ok {
		t.Fatalf("expected *kya.AuthError, got %T: %v", err, err)
	}
}

func TestGetCardSVG(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/agents/test-agent/card" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if r.URL.Query().Get("format") != "" {
			t.Errorf("SVG endpoint should not have format param")
		}
		w.Header().Set("Content-Type", "image/svg+xml")
		w.Write([]byte(`<svg xmlns="http://www.w3.org/2000/svg"><text>test</text></svg>`))
	}))
	defer srv.Close()

	client := newTestClient(srv)
	rc, err := client.GetCardSVG(context.Background(), "test-agent")
	if err != nil {
		t.Fatalf("GetCardSVG: %v", err)
	}
	defer rc.Close()
}
