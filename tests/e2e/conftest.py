"""
pytest configuration for SecureBase E2E tests.

Registers the --stripe-mode CLI option and propagates it as the
STRIPE_MODE environment variable so that unittest.TestCase-based test
classes can read it without relying on pytest fixtures.
"""

import os
import pytest


def pytest_addoption(parser):
    parser.addoption(
        "--stripe-mode",
        default="mock",
        choices=["mock", "sandbox"],
        help=(
            "Stripe integration mode: "
            "'mock' (offline, no network, uses MagicMock) or "
            "'sandbox' (live Stripe Test API, requires STRIPE_SECRET_KEY "
            "set to a sk_test_… key and STRIPE_PRICE_STANDARD pointing to "
            "a real test-mode Price ID)."
        ),
    )


def pytest_configure(config):
    config.addinivalue_line(
        "markers",
        "stripe_sandbox: mark test as requiring live Stripe sandbox access",
    )


@pytest.fixture(scope="session", autouse=True)
def set_stripe_mode(request):
    """Propagate --stripe-mode into STRIPE_MODE for unittest-based tests."""
    mode = request.config.getoption("--stripe-mode")
    original = os.environ.get("STRIPE_MODE")
    os.environ["STRIPE_MODE"] = mode
    yield mode
    # Restore original value (or remove if it was not previously set)
    if original is None:
        os.environ.pop("STRIPE_MODE", None)
    else:
        os.environ["STRIPE_MODE"] = original
