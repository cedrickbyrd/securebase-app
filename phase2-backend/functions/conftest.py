"""
Test configuration and fixtures for Phase 2 Backend tests.
Sets up Python path to include lambda_layer modules.
"""

import sys
import os

# Add lambda_layer/python to path so tests can import db_utils and other layer modules
lambda_layer_path = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    'lambda_layer',
    'python'
)

if lambda_layer_path not in sys.path:
    sys.path.insert(0, lambda_layer_path)
