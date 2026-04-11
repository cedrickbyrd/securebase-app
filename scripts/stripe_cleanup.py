#!/usr/bin/env python3
"""
Stripe Test Data Cleanup Script
================================
Removes Stripe test objects (Customers, Checkout Sessions, Subscriptions)
that were created by the SecureBase E2E test suite.

Objects are identified by a ``test_run_id`` key in their Stripe metadata.
Every E2E run tags its objects with the GitHub Actions run ID so that
cleanup is precise and idempotent across concurrent CI jobs.

Usage
-----
# Clean up objects from a specific GitHub Actions run:
python scripts/stripe_cleanup.py --run-id 12345678

# Clean up objects created in the last 2 hours:
python scripts/stripe_cleanup.py --hours 2

# Clean up ALL objects tagged as test data (requires confirmation):
python scripts/stripe_cleanup.py --all-test-data

# Preview without deleting:
python scripts/stripe_cleanup.py --run-id 12345678 --dry-run

The script exits 0 on success and 1 if any Stripe API error occurred.
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

try:
    import stripe as _default_stripe_module
except ImportError:
    _default_stripe_module = None  # type: ignore[assignment]


class StripeTestCleaner:
    """
    Deletes Stripe test objects created by the SecureBase E2E test suite.

    Parameters
    ----------
    api_key:
        Stripe restricted test key (``sk_test_…``).  Must be a test key;
        the class refuses to run against live keys to prevent accidental
        production data deletion.
    dry_run:
        When *True*, log what would be deleted but make no API calls.
    stripe_module:
        Optional: inject a specific stripe module instance.  Useful in
        test environments where ``sys.modules['stripe']`` has been
        replaced with a ``MagicMock`` but a reference to the real module
        is still available (e.g. ``_real_stripe`` in the test file).
    """

    def __init__(
        self,
        api_key: str,
        dry_run: bool = False,
        force: bool = False,
        stripe_module=None,
    ) -> None:
        if stripe_module is not None:
            self._stripe = stripe_module
        elif _default_stripe_module is not None:
            self._stripe = _default_stripe_module
        else:
            raise ImportError(
                "The 'stripe' package is required. "
                "Install it with: pip install stripe"
            )
        self._stripe.api_key = api_key
        self.dry_run = dry_run
        self.force = force
        self.stats: Dict[str, int] = {
            "customers_deleted": 0,
            "sessions_expired": 0,
            "subscriptions_cancelled": 0,
            "errors": 0,
        }

    # ------------------------------------------------------------------
    # Public entry points
    # ------------------------------------------------------------------

    def cleanup_by_time_range(self, hours: int = 1) -> None:
        """Clean up test data created within the last *hours* hours."""
        cutoff_time = int(
            (datetime.now(timezone.utc) - timedelta(hours=hours)).timestamp()
        )
        print(f"\n{'=' * 70}")
        print(f"Cleaning up test data from last {hours} hour(s)")
        print(f"Cutoff time: {datetime.fromtimestamp(cutoff_time).isoformat()}")
        print(f"{'=' * 70}\n")
        self._cleanup_customers(created_after=cutoff_time)
        self._cleanup_sessions(created_after=cutoff_time)
        self._print_summary()

    def cleanup_by_run_id(self, run_id: str) -> None:
        """Clean up test data from a specific CI run."""
        print(f"\n{'=' * 70}")
        print(f"Cleaning up test data for run ID: {run_id}")
        print(f"{'=' * 70}\n")
        self._cleanup_customers(metadata_filter={"test_run_id": run_id})
        self._cleanup_sessions(metadata_filter={"test_run_id": run_id})
        self._print_summary()

    def cleanup_all_test_data(self) -> None:
        """Clean up ALL objects marked as test data."""
        print(f"\n{'=' * 70}")
        print("WARNING: Cleaning up ALL test data")
        print(f"{'=' * 70}\n")
        if not self.dry_run and not self.force:
            if not sys.stdin.isatty():
                print(
                    "❌ Non-interactive environment detected. "
                    "Pass --force to bypass confirmation in CI."
                )
                return
            confirm = input(
                "Are you sure? This will delete all test customers (y/N): "
            )
            if confirm.strip().lower() != "y":
                print("Cancelled")
                return
        self._cleanup_customers(all_test_data=True)
        self._cleanup_sessions(all_test_data=True)
        self._print_summary()

    # ------------------------------------------------------------------
    # Customer cleanup
    # ------------------------------------------------------------------

    def _cleanup_customers(
        self,
        created_after: Optional[int] = None,
        metadata_filter: Optional[Dict[str, str]] = None,
        all_test_data: bool = False,
    ) -> None:
        """Delete test customers (and their active subscriptions)."""
        print("🔍 Searching for test customers...")
        try:
            query_params: Dict = {"limit": 100}
            if created_after:
                query_params["created"] = {"gte": created_after}
            customers = self._stripe.Customer.list(**query_params)
            deleted_count = 0
            for customer in customers.auto_paging_iter():
                if self._should_process(
                    customer, created_after, metadata_filter, all_test_data
                ):
                    self._delete_customer(customer)
                    deleted_count += 1
            print(f"✅ Processed {deleted_count} customer(s)")
        except Exception as exc:
            print(f"❌ Error fetching customers: {exc}")
            self.stats["errors"] += 1

    def _delete_customer(self, customer) -> None:
        """Cancel subscriptions then delete a single customer."""
        customer_id = customer.id
        email = getattr(customer, "email", None) or "No email"
        metadata = getattr(customer, "metadata", {}) or {}
        run_id = metadata.get("test_run_id", "unknown")

        if self.dry_run:
            print(f"  [DRY RUN] Would delete customer {customer_id}")
            print(f"            Email:  {email}")
            print(f"            Run ID: {run_id}")
            self.stats["customers_deleted"] += 1
            return

        try:
            # Cancel active subscriptions before deleting the customer.
            subs = self._stripe.Subscription.list(
                customer=customer_id, status="active"
            )
            for sub in subs.auto_paging_iter():
                self._stripe.Subscription.delete(sub.id)
                self.stats["subscriptions_cancelled"] += 1
                print(f"  ✅ Cancelled subscription {sub.id}")

            self._stripe.Customer.delete(customer_id)
            self.stats["customers_deleted"] += 1
            print(f"  ✅ Deleted customer {customer_id}")
            print(f"     Email:  {email}")
            print(f"     Run ID: {run_id}")
        except Exception as exc:
            print(f"  ❌ Failed to delete {customer_id}: {exc}")
            self.stats["errors"] += 1

    # ------------------------------------------------------------------
    # Session cleanup
    # ------------------------------------------------------------------

    def _cleanup_sessions(
        self,
        created_after: Optional[int] = None,
        metadata_filter: Optional[Dict[str, str]] = None,
        all_test_data: bool = False,
    ) -> None:
        """Expire open test checkout sessions."""
        print("\n🔍 Searching for test checkout sessions...")
        try:
            query_params: Dict = {"limit": 100}
            if created_after:
                query_params["created"] = {"gte": created_after}
            sessions = self._stripe.checkout.Session.list(**query_params)
            expired_count = 0
            for session in sessions.auto_paging_iter():
                if (
                    getattr(session, "status", None) == "open"
                    and self._should_process(
                        session, created_after, metadata_filter, all_test_data
                    )
                ):
                    self._expire_session(session)
                    expired_count += 1
            print(f"✅ Processed {expired_count} session(s)")
        except Exception as exc:
            print(f"❌ Error fetching sessions: {exc}")
            self.stats["errors"] += 1

    def _expire_session(self, session) -> None:
        """Expire a single open checkout session."""
        session_id = session.id
        # customer_email is set directly on the session; customer_details is
        # an object (Stripe StripeObject), so use getattr with a fallback.
        email = getattr(session, "customer_email", None)
        if not email:
            details = getattr(session, "customer_details", None)
            email = (
                getattr(details, "email", None)
                if details is not None
                else "No email"
            ) or "No email"

        if self.dry_run:
            print(f"  [DRY RUN] Would expire session {session_id}")
            print(f"            Email: {email}")
            self.stats["sessions_expired"] += 1
            return

        try:
            self._stripe.checkout.Session.expire(session_id)
            self.stats["sessions_expired"] += 1
            print(f"  ✅ Expired session {session_id}")
            print(f"     Email: {email}")
        except Exception as exc:
            print(f"  ❌ Failed to expire {session_id}: {exc}")
            self.stats["errors"] += 1

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _should_process(
        obj: Any,
        created_after: Optional[int],
        metadata_filter: Optional[Dict[str, str]],
        all_test_data: bool,
    ) -> bool:
        """Return True if *obj* meets the deletion/expiration criteria."""
        metadata = getattr(obj, "metadata", {}) or {}
        if all_test_data:
            return "test_run_id" in metadata
        if metadata_filter:
            return all(
                metadata.get(k) == v for k, v in metadata_filter.items()
            )
        if created_after is not None:
            return (
                getattr(obj, "created", 0) >= created_after
                and "test_run_id" in metadata
            )
        return False

    def _print_summary(self) -> None:
        """Print a human-readable cleanup summary."""
        print(f"\n{'=' * 70}")
        print("CLEANUP SUMMARY")
        print(f"{'=' * 70}")
        print(f"Mode:                    {'DRY RUN' if self.dry_run else 'LIVE'}")
        print(f"Customers deleted:       {self.stats['customers_deleted']}")
        print(f"Subscriptions cancelled: {self.stats['subscriptions_cancelled']}")
        print(f"Sessions expired:        {self.stats['sessions_expired']}")
        print(f"Errors:                  {self.stats['errors']}")
        print(f"{'=' * 70}\n")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="stripe_cleanup",
        description="Delete Stripe test objects created by the SecureBase E2E suite.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
examples:
  # Clean up a specific GitHub Actions run
  python scripts/stripe_cleanup.py --run-id 12345678

  # Clean up objects from the last 2 hours
  python scripts/stripe_cleanup.py --hours 2

  # Preview without deleting
  python scripts/stripe_cleanup.py --run-id 12345678 --dry-run

  # Remove ALL test data (interactive confirmation required)
  python scripts/stripe_cleanup.py --all-test-data
""",
    )
    parser.add_argument(
        "--api-key",
        default=None,
        help=(
            "Stripe restricted test key (sk_test_…).  "
            "Falls back to the STRIPE_SECRET_KEY environment variable."
        ),
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--run-id",
        metavar="RUN_ID",
        help="GitHub Actions run ID; deletes objects whose metadata.test_run_id matches.",
    )
    group.add_argument(
        "--hours",
        type=int,
        metavar="N",
        help="Delete test objects created within the last N hours.",
    )
    group.add_argument(
        "--all-test-data",
        action="store_true",
        help="Delete ALL objects tagged as test data (prompts for confirmation).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Log what would be deleted without making any API calls.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help=(
            "Skip the interactive confirmation prompt when using --all-test-data. "
            "Required when running in non-TTY environments such as GitHub Actions."
        ),
    )
    return parser


def main(argv=None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)

    api_key = args.api_key or os.getenv("STRIPE_SECRET_KEY", "")
    if not api_key:
        parser.error(
            "No Stripe API key provided. "
            "Pass --api-key or set the STRIPE_SECRET_KEY environment variable."
        )
    if not api_key.startswith("sk_test_"):
        parser.error(
            f"STRIPE_SECRET_KEY must be a Stripe *test* key (sk_test_…).  "
            f"Got prefix: {api_key[:8]}…  "
            "Live keys are not permitted in this script."
        )

    try:
        cleaner = StripeTestCleaner(
            api_key=api_key,
            dry_run=args.dry_run,
            force=args.force,
        )
    except ImportError as exc:
        print(f"❌ {exc}", file=sys.stderr)
        return 1

    if args.run_id:
        cleaner.cleanup_by_run_id(args.run_id)
    elif args.hours:
        cleaner.cleanup_by_time_range(hours=args.hours)
    elif args.all_test_data:
        cleaner.cleanup_all_test_data()

    return 1 if cleaner.stats["errors"] > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
