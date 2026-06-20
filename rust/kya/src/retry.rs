//! Retry logic for rate-limited responses.

use std::time::Duration;
use tokio::time::sleep;

/// Pause execution for the given number of seconds (rate-limit back-off).
pub(crate) async fn wait_secs(secs: u64) {
    sleep(Duration::from_secs(secs)).await;
}

/// Parse a `Retry-After` header value (seconds as integer or HTTP-date).
/// Returns the number of seconds to wait, defaulting to `fallback` if parsing fails.
pub(crate) fn parse_retry_after(header_value: &str, fallback: u64) -> u64 {
    if let Ok(secs) = header_value.trim().parse::<u64>() {
        return secs;
    }
    // HTTP-date form not handled — return fallback
    fallback
}
