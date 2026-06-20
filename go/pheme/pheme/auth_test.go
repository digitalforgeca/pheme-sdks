package pheme_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/digitalforgeca/pheme-sdk-go/pheme"
)

func TestAPIKeyAuth(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-API-Key") != "phm_your_api_key_here" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		writeJSON(w, map[string]any{"status": "ok"})
	})
	srv := httptest.NewServer(mux)
	defer srv.Close()

	c := pheme.New(
		pheme.WithBaseURL(srv.URL),
		pheme.WithTimeout(5*time.Second),
		pheme.WithAPIKey("phm_your_api_key_here"),
	)

	h, err := c.Health(context.Background())
	if err != nil {
		t.Fatalf("expected auth success, got: %v", err)
	}
	if h.Status != "ok" {
		t.Errorf("expected status=ok, got %q", h.Status)
	}
}

func TestJWTAuth(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer test-jwt-token" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		writeJSON(w, map[string]any{"status": "ok"})
	})
	srv := httptest.NewServer(mux)
	defer srv.Close()

	c := pheme.New(
		pheme.WithBaseURL(srv.URL),
		pheme.WithTimeout(5*time.Second),
		pheme.WithJWT("test-jwt-token"),
	)

	h, err := c.Health(context.Background())
	if err != nil {
		t.Fatalf("expected JWT auth success, got: %v", err)
	}
	if h.Status != "ok" {
		t.Errorf("expected status=ok, got %q", h.Status)
	}
}
