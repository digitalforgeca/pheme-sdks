"""Tests for KYA SDK error classes."""

import pytest

from kya.errors import (
    KyaApiError,
    KyaAuthError,
    KyaError,
    KyaNetworkError,
    KyaNotFoundError,
    KyaRateLimitError,
)


def test_kya_error_is_base() -> None:
    assert issubclass(KyaApiError, KyaError)
    assert issubclass(KyaRateLimitError, KyaApiError)
    assert issubclass(KyaAuthError, KyaApiError)
    assert issubclass(KyaNotFoundError, KyaApiError)
    assert issubclass(KyaNetworkError, KyaError)


def test_api_error_attrs() -> None:
    err = KyaApiError(500, "Internal Server Error", body="oops")
    assert err.status_code == 500
    assert err.message == "Internal Server Error"
    assert err.body == "oops"
    assert "500" in str(err)


def test_rate_limit_error() -> None:
    err = KyaRateLimitError(retry_after=5.0)
    assert err.status_code == 429
    assert err.retry_after == 5.0
    assert "5.0" in str(err)


def test_auth_error() -> None:
    err = KyaAuthError()
    assert err.status_code == 401


def test_not_found_error() -> None:
    err = KyaNotFoundError(resource="Agent")
    assert err.status_code == 404
    assert "Agent" in err.message


def test_network_error() -> None:
    err = KyaNetworkError("Connection refused")
    assert "Connection refused" in str(err)


def test_raise_as_exception() -> None:
    with pytest.raises(KyaError):
        raise KyaApiError(400, "Bad Request")

    with pytest.raises(KyaApiError):
        raise KyaRateLimitError(1.0)
