"""
Unit tests for health_check Lambda function.
"""

import json
import unittest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime

# Import the module under test
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from health_check import lambda_handler, check_database


class TestHealthCheck(unittest.TestCase):
    """Test cases for health check endpoint."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.mock_event = {
            "httpMethod": "GET",
            "path": "/health"
        }
        self.mock_context = Mock()
    
    @patch('health_check.check_database')
    def test_healthy_response(self, mock_check_db):
        """Test successful health check with all systems healthy."""
        # Mock successful database check
        mock_check_db.return_value = {"status": "healthy"}
        
        # Call handler
        response = lambda_handler(self.mock_event, self.mock_context)
        
        # Verify response
        self.assertEqual(response["statusCode"], 200)
        self.assertIn("Content-Type", response["headers"])
        self.assertEqual(response["headers"]["Content-Type"], "application/json")
        
        # Parse and verify body
        body = json.loads(response["body"])
        self.assertEqual(body["status"], "healthy")
        self.assertEqual(body["version"], "2.0.0")
        self.assertIn("timestamp", body)
        self.assertIn("checks", body)
        self.assertEqual(body["checks"]["database"], "healthy")
        self.assertNotIn("errors", body)
    
    @patch('health_check.check_database')
    def test_degraded_response(self, mock_check_db):
        """Test health check with database unhealthy."""
        # Mock failed database check
        mock_check_db.return_value = {
            "status": "unhealthy",
            "error": "Connection timeout"
        }
        
        # Call handler
        response = lambda_handler(self.mock_event, self.mock_context)
        
        # Verify response
        self.assertEqual(response["statusCode"], 503)
        
        # Parse and verify body
        body = json.loads(response["body"])
        self.assertEqual(body["status"], "degraded")
        self.assertEqual(body["checks"]["database"], "unhealthy")
        self.assertIn("errors", body)
        self.assertEqual(len(body["errors"]), 1)
        self.assertEqual(body["errors"][0]["component"], "database")
        self.assertEqual(body["errors"][0]["error"], "Connection timeout")
    
    @patch('health_check.get_connection')
    @patch('health_check.release_connection')
    def test_database_check_success(self, mock_release, mock_get_conn):
        """Test successful database connectivity check."""
        # Mock database connection and cursor
        mock_cursor = Mock()
        mock_cursor.fetchone.return_value = (1,)
        
        mock_conn = Mock()
        mock_conn.cursor.return_value = mock_cursor
        
        mock_get_conn.return_value = mock_conn
        
        # Call check_database
        result = check_database()
        
        # Verify
        self.assertEqual(result["status"], "healthy")
        self.assertNotIn("error", result)
        mock_cursor.execute.assert_called_once_with("SELECT 1 as healthy")
        mock_cursor.close.assert_called_once()
        mock_release.assert_called_once_with(mock_conn)
    
    @patch('health_check.get_connection')
    def test_database_check_failure(self, mock_get_conn):
        """Test database check when connection fails."""
        # Mock database connection failure
        from health_check import DatabaseError
        mock_get_conn.side_effect = DatabaseError("Connection refused")
        
        # Call check_database
        result = check_database()
        
        # Verify
        self.assertEqual(result["status"], "unhealthy")
        self.assertIn("error", result)
        self.assertIn("Connection refused", result["error"])
    
    @patch('health_check.check_database')
    def test_handler_exception(self, mock_check_db):
        """Test handler when an unexpected exception occurs."""
        # Mock check_database to raise exception
        mock_check_db.side_effect = RuntimeError("Unexpected error")
        
        # Call handler
        response = lambda_handler(self.mock_event, self.mock_context)
        
        # Verify error response
        self.assertEqual(response["statusCode"], 503)
        
        body = json.loads(response["body"])
        self.assertEqual(body["status"], "error")
        self.assertIn("error", body)
    
    @patch('health_check.check_database')
    def test_cache_control_headers(self, mock_check_db):
        """Test that cache control headers are set correctly."""
        mock_check_db.return_value = {"status": "healthy"}
        
        response = lambda_handler(self.mock_event, self.mock_context)
        
        # Verify cache control header
        self.assertIn("Cache-Control", response["headers"])
        self.assertEqual(
            response["headers"]["Cache-Control"],
            "no-cache, no-store, must-revalidate"
        )
    
    @patch('health_check.check_database')
    def test_timestamp_format(self, mock_check_db):
        """Test that timestamp is in ISO 8601 format."""
        mock_check_db.return_value = {"status": "healthy"}
        
        response = lambda_handler(self.mock_event, self.mock_context)
        
        body = json.loads(response["body"])
        timestamp = body["timestamp"]
        
        # Verify timestamp format (ISO 8601 with Z suffix)
        self.assertTrue(timestamp.endswith("Z"))
        # Should be parseable as ISO format
        try:
            datetime.fromisoformat(timestamp.rstrip("Z"))
        except ValueError:
            self.fail("Timestamp is not in valid ISO 8601 format")


class TestDatabaseCheckWithoutUtils(unittest.TestCase):
    """Test database check when db_utils is not available."""
    
    @patch('health_check.get_connection', None)
    def test_no_db_utils(self):
        """Test check_database when db_utils is not available."""
        result = check_database()
        
        self.assertEqual(result["status"], "unavailable")
        self.assertIn("error", result)
        self.assertIn("db_utils not available", result["error"])


if __name__ == '__main__':
    unittest.main()
