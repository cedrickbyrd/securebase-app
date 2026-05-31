"""
fix_notes: validate_invite_token and accept_invite now treat a missing
`status` field as equivalent to `active`, matching the behaviour of the
old write_invite_token() which did not write a status field.

This is a defensive fallback only. The canonical fix is the backfill
script (scripts/backfill_wave1_tokens.py) which sets status=active on
all 17 Wave 1 records. Once the backfill has run this fallback is a no-op.
"""

_ACTIVE_STATUSES = {"active", None}  # None = field absent (pre-backfill records)


def _is_token_active(token_record: dict) -> bool:
    """Return True if the token is usable (active or legacy no-status record)."""
    return token_record.get("status") in _ACTIVE_STATUSES
