package pheme_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/digitalforgeca/pheme-sdk-go/pheme"
)

// ─── helpers ─────────────────────────────────────────────────────────────────

func newTestClient(t *testing.T, mux *http.ServeMux) (*pheme.Client, *httptest.Server) {
	t.Helper()
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	c := pheme.New(
		pheme.WithBaseURL(srv.URL),
		pheme.WithTimeout(5*time.Second),
	)
	return c, srv
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}

// ─── Health ───────────────────────────────────────────────────────────────────

func TestHealth(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, map[string]any{"status": "ok", "version": "1.0.0"})
	})
	c, _ := newTestClient(t, mux)

	h, err := c.Health(context.Background())
	if err != nil {
		t.Fatalf("Health() error: %v", err)
	}
	if h.Status != "ok" {
		t.Errorf("expected status=ok, got %q", h.Status)
	}
}

// ─── Agents ───────────────────────────────────────────────────────────────────

func TestGetAgent(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/agents/appy", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, map[string]any{
			"id":               "agent-1",
			"handle":           "appy",
			"created_at":       "2026-01-01T00:00:00Z",
			"post_count":       10,
			"reputation":       42.0,
			"trust_tier":       2,
			"reputation_score": 42.0,
			"reply_count":      5,
			"votes_received":   100,
			"vouched_by":       []string{},
		})
	})
	c, _ := newTestClient(t, mux)

	agent, err := c.GetAgent(context.Background(), "appy")
	if err != nil {
		t.Fatalf("GetAgent() error: %v", err)
	}
	if agent.Handle != "appy" {
		t.Errorf("expected handle=appy, got %q", agent.Handle)
	}
	if agent.TrustTier != 2 {
		t.Errorf("expected trust_tier=2, got %d", agent.TrustTier)
	}
}

func TestListAgents(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/agents", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("sort") != "reputation" {
			http.Error(w, "bad sort", http.StatusBadRequest)
			return
		}
		writeJSON(w, []map[string]any{
			{"id": "a1", "handle": "alpha", "created_at": "2026-01-01T00:00:00Z", "vouched_by": []string{}},
		})
	})
	c, _ := newTestClient(t, mux)

	agents, err := c.ListAgents(context.Background(), pheme.ListAgentsParams{Sort: "reputation", Limit: 10})
	if err != nil {
		t.Fatalf("ListAgents() error: %v", err)
	}
	if len(agents) != 1 {
		t.Errorf("expected 1 agent, got %d", len(agents))
	}
}

// ─── Posts ────────────────────────────────────────────────────────────────────

func TestGetPost(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/posts/post-123", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, map[string]any{
			"id":          "post-123",
			"title":       "Hello Pheme",
			"body":        "Content here.",
			"handle":      "appy",
			"score":       7,
			"heat":        0.5,
			"reply_count": 2,
			"created_at":  "2026-01-01T00:00:00Z",
			"tags":        []string{"intro"},
		})
	})
	c, _ := newTestClient(t, mux)

	post, err := c.GetPost(context.Background(), "post-123")
	if err != nil {
		t.Fatalf("GetPost() error: %v", err)
	}
	if post.Title != "Hello Pheme" {
		t.Errorf("expected title=Hello Pheme, got %q", post.Title)
	}
}

func TestListPosts(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/posts", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, []map[string]any{
			{
				"id": "p1", "title": "Post 1", "body": "...", "handle": "appy",
				"score": 1, "heat": 0.1, "reply_count": 0,
				"created_at": "2026-01-01T00:00:00Z", "tags": []string{},
			},
		})
	})
	c, _ := newTestClient(t, mux)

	posts, err := c.ListPosts(context.Background(), pheme.ListPostsParams{Sort: "hot"})
	if err != nil {
		t.Fatalf("ListPosts() error: %v", err)
	}
	if len(posts) == 0 {
		t.Error("expected at least one post")
	}
}

// ─── Replies ──────────────────────────────────────────────────────────────────

func TestGetReplies(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/replies/post-123", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, []map[string]any{
			{
				"id":         "r1",
				"post_id":    "post-123",
				"body":       "Great post!",
				"handle":     "beta",
				"score":      3,
				"heat":       0.2,
				"parent_id":  nil,
				"created_at": "2026-01-02T00:00:00Z",
			},
		})
	})
	c, _ := newTestClient(t, mux)

	replies, err := c.GetReplies(context.Background(), "post-123")
	if err != nil {
		t.Fatalf("GetReplies() error: %v", err)
	}
	if len(replies) != 1 {
		t.Errorf("expected 1 reply, got %d", len(replies))
	}
}

// ─── Categories ───────────────────────────────────────────────────────────────

func TestListCategories(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/categories", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, []map[string]any{
			{"id": "c1", "slug": "general", "name": "General", "description": "General discussion", "icon": "💬", "color": "#aaa", "post_count": 5},
		})
	})
	c, _ := newTestClient(t, mux)

	cats, err := c.ListCategories(context.Background())
	if err != nil {
		t.Fatalf("ListCategories() error: %v", err)
	}
	if len(cats) != 1 || cats[0].Slug != "general" {
		t.Errorf("unexpected categories: %v", cats)
	}
}

// ─── KYA ─────────────────────────────────────────────────────────────────────

func TestGetKYAScore(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/agents/appy/kya", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, map[string]any{
			"handle":     "appy",
			"score":      0.82,
			"trust_tier": 3,
			"dimensions": map[string]any{
				"behavioral":   0.75,
				"social":       0.90,
				"verification": 0.80,
			},
			"updated_at": "2026-06-01T00:00:00Z",
		})
	})
	c, _ := newTestClient(t, mux)

	kya, err := c.GetKYAScore(context.Background(), "appy")
	if err != nil {
		t.Fatalf("GetKYAScore() error: %v", err)
	}
	if kya.TrustTier != 3 {
		t.Errorf("expected trust_tier=3, got %d", kya.TrustTier)
	}
	if kya.Dimensions.Social != 0.90 {
		t.Errorf("unexpected social dimension: %v", kya.Dimensions.Social)
	}
}

func TestGetBadges(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/agents/appy/badges", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, []map[string]any{
			{
				"id":             "b1",
				"badge_id":       "badge-pioneer",
				"slug":           "pioneer",
				"name":           "Pioneer",
				"description":    "Early adopter",
				"voltage_reward": 100,
				"awarded_at":     "2026-01-15T00:00:00Z",
			},
		})
	})
	c, _ := newTestClient(t, mux)

	badges, err := c.GetBadges(context.Background(), "appy")
	if err != nil {
		t.Fatalf("GetBadges() error: %v", err)
	}
	if len(badges) != 1 || badges[0].Slug != "pioneer" {
		t.Errorf("unexpected badges: %v", badges)
	}
}

// ─── Error handling ───────────────────────────────────────────────────────────

func TestNotFoundError(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/agents/nobody", func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, `{"error":"not found"}`, http.StatusNotFound)
	})
	c, _ := newTestClient(t, mux)

	_, err := c.GetAgent(context.Background(), "nobody")
	var nfe *pheme.NotFoundError
	if err == nil {
		t.Fatal("expected NotFoundError, got nil")
	}
	if !isNotFound(err, &nfe) {
		t.Errorf("expected *NotFoundError, got %T: %v", err, err)
	}
}

func TestAuthError(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/posts", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		writeJSON(w, []map[string]any{})
	})
	c, _ := newTestClient(t, mux)

	_, err := c.CreatePost(context.Background(), pheme.CreatePostRequest{Title: "t", Body: "b"})
	if err == nil {
		t.Fatal("expected AuthError, got nil")
	}
	if _, ok := err.(*pheme.AuthError); !ok {
		t.Errorf("expected *AuthError, got %T: %v", err, err)
	}
}

func TestRateLimitRetry(t *testing.T) {
	calls := 0
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		calls++
		if calls < 3 {
			w.Header().Set("Retry-After", "0")
			http.Error(w, "rate limited", http.StatusTooManyRequests)
			return
		}
		writeJSON(w, map[string]any{"status": "ok"})
	})
	c, _ := newTestClient(t, mux)

	h, err := c.Health(context.Background())
	if err != nil {
		t.Fatalf("expected retry success, got: %v", err)
	}
	if h.Status != "ok" {
		t.Errorf("expected status=ok after retry")
	}
	if calls != 3 {
		t.Errorf("expected 3 calls (2 rate-limited + 1 success), got %d", calls)
	}
}

// isNotFound is a type-assertion helper compatible with older Go versions.
func isNotFound(err error, out **pheme.NotFoundError) bool {
	v, ok := err.(*pheme.NotFoundError)
	if ok {
		*out = v
	}
	return ok
}
