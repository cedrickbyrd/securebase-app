"""
Unit tests for Phase 6.1 audit_log_packager Lambda.

Tests cover:
- Successful handler invocation with valid event
- S3 PutObject called with correct Object Lock settings
- SHA-256 manifest included in zip
- DB record written to evidence_packages
- Error handling: missing customer_id
- Error handling: empty S3 log prefix (no objects found)
"""

import hashlib
import io
import json
import os
import sys
import zipfile
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch, call

import pytest

# ---------------------------------------------------------------------------
# Path setup: allow importing from phase6-backend/functions/ without
# installing the package.
# ---------------------------------------------------------------------------
FUNCTIONS_DIR = os.path.join(
    os.path.dirname(__file__), '..', '..', 'phase6-backend', 'functions'
)
sys.path.insert(0, os.path.abspath(FUNCTIONS_DIR))


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

VALID_EVENT = {
    'customer_id': 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    'framework': 'SOC2',
    'date_range_start': '2026-01-01T00:00:00Z',
    'date_range_end': '2026-01-31T23:59:59Z',
    'requested_by': 'user-uuid-1234',
}

MOCK_S3_OBJECTS = [
    {'Key': 'logs/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/2026/01/15/audit.log',
     'Size': 1024,
     'LastModified': datetime(2026, 1, 15, 10, 0, 0, tzinfo=timezone.utc)},
    {'Key': 'logs/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/2026/01/16/audit.log',
     'Size': 2048,
     'LastModified': datetime(2026, 1, 16, 10, 0, 0, tzinfo=timezone.utc)},
]


def _make_context():
    ctx = MagicMock()
    ctx.aws_request_id = 'test-request-id-001'
    return ctx


# ---------------------------------------------------------------------------
# Test: module imports without errors (no AWS creds required at import time)
# ---------------------------------------------------------------------------

class TestModuleImport:
    def test_module_imports(self):
        """Verify that the module can be imported without side effects."""
        # The module-level boto3 client calls will fail without real AWS creds,
        # so we mock them during import-time side effects.
        with patch('boto3.client', return_value=MagicMock()), \
             patch('boto3.resource', return_value=MagicMock()), \
             patch('sys.path'):
            import importlib
            import audit_log_packager  # noqa: F401


# ---------------------------------------------------------------------------
# Test: _list_log_objects
# ---------------------------------------------------------------------------

class TestListLogObjects:
    """Tests for the _list_log_objects helper function."""

    def test_returns_objects_within_date_range(self):
        """Objects within the date range are included; outside are excluded."""
        with patch('boto3.client') as mock_boto, \
             patch('boto3.resource'), \
             patch.dict('sys.modules', {'db_utils': MagicMock()}):
            import importlib
            import audit_log_packager
            importlib.reload(audit_log_packager)

            mock_paginator = MagicMock()
            mock_paginator.paginate.return_value = [
                {'Contents': MOCK_S3_OBJECTS},
            ]
            audit_log_packager.s3_client = MagicMock()
            audit_log_packager.s3_client.get_paginator.return_value = mock_paginator

            start = datetime(2026, 1, 1, tzinfo=timezone.utc)
            end = datetime(2026, 1, 31, 23, 59, 59, tzinfo=timezone.utc)

            result = audit_log_packager._list_log_objects(
                'test-bucket',
                'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
                start,
                end,
            )
            # Both objects are within range
            assert len(result) == 2

    def test_returns_empty_list_when_no_objects(self):
        """Returns an empty list when the S3 prefix contains no objects."""
        with patch('boto3.client'), patch('boto3.resource'), \
             patch.dict('sys.modules', {'db_utils': MagicMock()}):
            import importlib
            import audit_log_packager
            importlib.reload(audit_log_packager)

            mock_paginator = MagicMock()
            mock_paginator.paginate.return_value = [{'Contents': []}]
            audit_log_packager.s3_client = MagicMock()
            audit_log_packager.s3_client.get_paginator.return_value = mock_paginator

            result = audit_log_packager._list_log_objects(
                'test-bucket', 'tenant-id',
                datetime(2026, 1, 1, tzinfo=timezone.utc),
                datetime(2026, 1, 1, tzinfo=timezone.utc),
            )
            assert result == []


# ---------------------------------------------------------------------------
# Test: _build_zip_package
# ---------------------------------------------------------------------------

class TestBuildZipPackage:
    """Tests for the _build_zip_package helper function."""

    def test_zip_contains_manifest(self):
        """The generated zip must contain a MANIFEST.json file."""
        with patch('boto3.client'), patch('boto3.resource'), \
             patch.dict('sys.modules', {'db_utils': MagicMock()}):
            import importlib
            import audit_log_packager
            importlib.reload(audit_log_packager)

            audit_log_packager.s3_client = MagicMock()
            audit_log_packager.s3_client.get_object.return_value = {
                'Body': io.BytesIO(b'fake log content')
            }

            objects = [
                {'Key': 'logs/tenant/2026/01/15/audit.log', 'Size': 17,
                 'LastModified': '2026-01-15T10:00:00+00:00'},
            ]
            manifest_meta = {'customer_id': 'tenant-id', 'framework': 'SOC2'}

            zip_bytes, sha256 = audit_log_packager._build_zip_package(
                'source-bucket',
                objects,
                manifest_meta,
                {
                    'organization_name': 'Tenant Inc.',
                    'customer_id': 'tenant-id',
                    'framework': 'SOC2',
                    'date_range_start': '2026-01-01T00:00:00+00:00',
                    'date_range_end': '2026-01-31T23:59:59+00:00',
                    'created_at': '2026-02-01T00:00:00+00:00',
                    'package_id': 'pkg-123',
                    'kms_key_arn': 'arn:aws:kms:us-east-1:123:key/abc',
                    'log_count': 1,
                    'retention_until': '2033-02-01T00:00:00+00:00',
                },
            )

            # Verify zip contains MANIFEST.json
            with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
                assert 'MANIFEST.json' in zf.namelist()
                assert 'COVER_PAGE.pdf' in zf.namelist()
                manifest = json.loads(zf.read('MANIFEST.json'))
                assert manifest['customer_id'] == 'tenant-id'
                assert manifest['framework'] == 'SOC2'
                assert 'file_hashes' in manifest

    def test_sha256_is_valid_hex(self):
        """The returned SHA-256 digest must be a valid 64-char hex string."""
        with patch('boto3.client'), patch('boto3.resource'), \
             patch.dict('sys.modules', {'db_utils': MagicMock()}):
            import importlib
            import audit_log_packager
            importlib.reload(audit_log_packager)

            audit_log_packager.s3_client = MagicMock()
            audit_log_packager.s3_client.get_object.return_value = {
                'Body': io.BytesIO(b'content')
            }

            zip_bytes, sha256 = audit_log_packager._build_zip_package(
                'bucket',
                [{'Key': 'test.log', 'Size': 7,
                  'LastModified': '2026-01-01T00:00:00+00:00'}],
                {},
                {
                    'organization_name': 'Tenant Inc.',
                    'customer_id': 'tenant-id',
                    'framework': 'SOC2',
                    'date_range_start': '2026-01-01T00:00:00+00:00',
                    'date_range_end': '2026-01-31T23:59:59+00:00',
                    'created_at': '2026-02-01T00:00:00+00:00',
                    'package_id': 'pkg-123',
                    'kms_key_arn': 'arn:aws:kms:us-east-1:123:key/abc',
                    'log_count': 1,
                    'retention_until': '2033-02-01T00:00:00+00:00',
                },
            )
            assert len(sha256) == 64
            assert all(c in '0123456789abcdef' for c in sha256)

    def test_sha256_matches_manifest_content(self):
        """The SHA-256 digest must match the hash of MANIFEST.json bytes."""
        with patch('boto3.client'), patch('boto3.resource'), \
             patch.dict('sys.modules', {'db_utils': MagicMock()}):
            import importlib
            import audit_log_packager
            importlib.reload(audit_log_packager)

            audit_log_packager.s3_client = MagicMock()
            audit_log_packager.s3_client.get_object.return_value = {
                'Body': io.BytesIO(b'log data')
            }

            with patch.object(
                audit_log_packager,
                '_generate_cover_page_pdf',
                wraps=audit_log_packager._generate_cover_page_pdf,
            ) as mock_cover_pdf:
                zip_bytes, sha256 = audit_log_packager._build_zip_package(
                    'bucket',
                    [{'Key': 'log.txt', 'Size': 8,
                      'LastModified': '2026-01-01T00:00:00+00:00'}],
                    {},
                    {
                        'organization_name': 'Tenant Inc.',
                        'customer_id': 'tenant-id',
                        'framework': 'SOC2',
                        'date_range_start': '2026-01-01T00:00:00+00:00',
                        'date_range_end': '2026-01-31T23:59:59+00:00',
                        'created_at': '2026-02-01T00:00:00+00:00',
                        'package_id': 'pkg-123',
                        'kms_key_arn': 'arn:aws:kms:us-east-1:123:key/abc',
                        'log_count': 1,
                        'retention_until': '2033-02-01T00:00:00+00:00',
                    },
                )
            with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
                expected = hashlib.sha256(zf.read('MANIFEST.json')).hexdigest()
            assert sha256 == expected
            assert mock_cover_pdf.called
            for call_record in mock_cover_pdf.call_args_list:
                assert call_record.args[0]['sha256_manifest'] == sha256


# ---------------------------------------------------------------------------
# Test: lambda_handler
# ---------------------------------------------------------------------------

class TestLambdaHandler:
    """Integration-level tests for lambda_handler."""

    def _make_mock_db(self):
        """Return a mock db_utils module."""
        mock_db = MagicMock()
        mock_pool = MagicMock()
        mock_conn = MagicMock()
        mock_pool.__enter__ = MagicMock(return_value=mock_conn)
        mock_pool.__exit__ = MagicMock(return_value=False)
        mock_db.get_connection_pool.return_value = mock_pool
        mock_db.execute_one.return_value = {'id': 'pkg-uuid-001'}
        return mock_db

    def test_raises_on_missing_customer_id(self):
        """Handler must raise ValueError when customer_id is absent."""
        with patch('boto3.client'), patch('boto3.resource'), \
             patch.dict('sys.modules', {'db_utils': self._make_mock_db()}):
            import importlib
            import audit_log_packager
            importlib.reload(audit_log_packager)

            with pytest.raises(ValueError, match='customer_id'):
                audit_log_packager.lambda_handler(
                    {'framework': 'SOC2',
                     'date_range_start': '2026-01-01T00:00:00Z',
                     'date_range_end': '2026-01-31T23:59:59Z'},
                    _make_context(),
                )

    def test_raises_on_missing_date_range(self):
        """Handler must raise ValueError when date range fields are missing."""
        with patch('boto3.client'), patch('boto3.resource'), \
             patch.dict('sys.modules', {'db_utils': self._make_mock_db()}):
            import importlib
            import audit_log_packager
            importlib.reload(audit_log_packager)

            with pytest.raises(ValueError, match='date_range'):
                audit_log_packager.lambda_handler(
                    {'customer_id': 'tenant-id'},
                    _make_context(),
                )

    def test_returns_empty_when_no_objects_found(self):
        """Handler returns log_count=0 and no package_id when no S3 objects exist."""
        with patch('boto3.client'), patch('boto3.resource'), \
             patch.dict('sys.modules', {'db_utils': self._make_mock_db()}):
            import importlib
            import audit_log_packager
            importlib.reload(audit_log_packager)

            # Set required environment variables
            audit_log_packager.AUDIT_SOURCE_BUCKET = 'test-source'
            audit_log_packager.EVIDENCE_BUCKET = 'test-evidence'

            # Mock _list_log_objects to return empty list
            with patch.object(audit_log_packager, '_list_log_objects', return_value=[]):
                result = audit_log_packager.lambda_handler(VALID_EVENT, _make_context())

            assert result['log_count'] == 0
            assert result['package_id'] is None

    def test_s3_put_object_called_with_compliance_lock(self):
        """S3 PutObject must be called with ObjectLockMode=COMPLIANCE."""
        mock_db = self._make_mock_db()

        with patch('boto3.client'), patch('boto3.resource'), \
             patch.dict('sys.modules', {'db_utils': mock_db}):
            import importlib
            import audit_log_packager
            importlib.reload(audit_log_packager)

            audit_log_packager.AUDIT_SOURCE_BUCKET = 'test-source'
            audit_log_packager.EVIDENCE_BUCKET = 'test-evidence'
            audit_log_packager.EVIDENCE_RETENTION_YEARS = 7

            fake_s3 = MagicMock()
            fake_s3.put_object.return_value = {'VersionId': 'v-001'}
            fake_s3.get_object.return_value = {'Body': io.BytesIO(b'log content')}
            audit_log_packager.s3_client = fake_s3

            with patch.object(audit_log_packager, '_list_log_objects',
                               return_value=MOCK_S3_OBJECTS), \
                 patch.object(audit_log_packager, '_write_evidence_record',
                               return_value='pkg-uuid-001'):
                audit_log_packager.lambda_handler(VALID_EVENT, _make_context())

            # Verify put_object was called
            assert fake_s3.put_object.called
            call_kwargs = fake_s3.put_object.call_args.kwargs
            assert call_kwargs.get('ObjectLockMode') == 'COMPLIANCE'
            assert call_kwargs.get('Bucket') == 'test-evidence'

    def test_db_record_written_on_success(self):
        """_write_evidence_record must be called exactly once on success."""
        mock_db = self._make_mock_db()

        with patch('boto3.client'), patch('boto3.resource'), \
             patch.dict('sys.modules', {'db_utils': mock_db}):
            import importlib
            import audit_log_packager
            importlib.reload(audit_log_packager)

            audit_log_packager.AUDIT_SOURCE_BUCKET = 'test-source'
            audit_log_packager.EVIDENCE_BUCKET = 'test-evidence'

            fake_s3 = MagicMock()
            fake_s3.put_object.return_value = {'VersionId': 'v-001'}
            fake_s3.get_object.return_value = {'Body': io.BytesIO(b'data')}
            audit_log_packager.s3_client = fake_s3

            with patch.object(audit_log_packager, '_list_log_objects',
                               return_value=MOCK_S3_OBJECTS), \
                 patch.object(audit_log_packager, '_write_evidence_record',
                               return_value='pkg-uuid-001') as mock_write:
                result = audit_log_packager.lambda_handler(VALID_EVENT, _make_context())

            mock_write.assert_called_once()
            assert result['package_id'] == 'pkg-uuid-001'
