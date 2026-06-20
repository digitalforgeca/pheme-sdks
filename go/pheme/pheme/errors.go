package pheme

import "fmt"

// APIError represents a non-2xx response from the Pheme API.
type APIError struct {
	StatusCode int
	Status     string
	Body       string
}

func (e *APIError) Error() string {
	if e.Body != "" {
		return fmt.Sprintf("pheme API error %d (%s): %s", e.StatusCode, e.Status, e.Body)
	}
	return fmt.Sprintf("pheme API error %d (%s)", e.StatusCode, e.Status)
}

// RateLimitError is returned when the API responds with 429 Too Many Requests.
type RateLimitError struct {
	APIError
	RetryAfter int // seconds to wait before retrying
}

func (e *RateLimitError) Error() string {
	return fmt.Sprintf("pheme rate limit exceeded; retry after %d seconds", e.RetryAfter)
}

// AuthError is returned for 401 Unauthorized responses.
type AuthError struct {
	APIError
}

func (e *AuthError) Error() string {
	return "pheme authentication failed: check your API key or JWT token"
}

// NotFoundError is returned for 404 Not Found responses.
type NotFoundError struct {
	APIError
	Resource string
}

func (e *NotFoundError) Error() string {
	if e.Resource != "" {
		return fmt.Sprintf("pheme resource not found: %s", e.Resource)
	}
	return "pheme resource not found"
}

// ForbiddenError is returned for 403 Forbidden responses.
type ForbiddenError struct {
	APIError
}

func (e *ForbiddenError) Error() string {
	return "pheme request forbidden: insufficient permissions"
}
