import importlib
import io
import json
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError

import pytest

import alert_router


@pytest.fixture(autouse=True)
def reset_cache(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "dev")
    monkeypatch.setenv("WEBHOOK_SSM_PARAM", "/securebase/alerts/webhook_url")
    with patch.object(alert_router, "_webhook_cache", None):
        yield


def _sns_event(state="ALARM", alarm_name="securebase-dev-api-5xx"):
    message = {
        "AlarmName": alarm_name,
        "AlarmDescription": "API error rate high",
        "NewStateValue": state,
        "NewStateReason": "Threshold Crossed",
        "Region": "us-east-1",
        "AWSAccountId": "123456789012",
    }
    return {
        "Records": [
            {
                "Sns": {
                    "Message": json.dumps(message)
                }
            }
        ]
    }


def test_severity_alarm():
    assert alert_router._severity("ALARM") == "critical"


def test_severity_ok():
    assert alert_router._severity("OK") == "info"


def test_pagerduty_payload_trigger():
    payload = alert_router._pagerduty_payload({"AlarmName": "a1"}, "ALARM", "dev")
    assert payload["event_action"] == "trigger"


def test_pagerduty_payload_resolve():
    payload = alert_router._pagerduty_payload({"AlarmName": "a1"}, "OK", "dev")
    assert payload["event_action"] == "resolve"


def test_slack_payload_alarm_color():
    payload = alert_router._slack_payload({"AlarmName": "a1"}, "ALARM", "dev")
    assert payload["attachments"][0]["color"] == "danger"


def test_slack_payload_ok_color():
    payload = alert_router._slack_payload({"AlarmName": "a1"}, "OK", "dev")
    assert payload["attachments"][0]["color"] == "good"


def test_get_webhook_url_success():
    mock_ssm = MagicMock()
    mock_ssm.get_parameter.return_value = {"Parameter": {"Value": "https://hooks.slack.com/services/test"}}

    with patch("alert_router.boto3.client", return_value=mock_ssm):
        importlib.reload(alert_router)

    first = alert_router._get_webhook_url()
    second = alert_router._get_webhook_url()

    assert first == "https://hooks.slack.com/services/test"
    assert second == "https://hooks.slack.com/services/test"
    assert mock_ssm.get_parameter.call_count == 1


def test_get_webhook_url_ssm_failure():
    mock_ssm = MagicMock()
    mock_ssm.get_parameter.side_effect = Exception("ssm unavailable")

    with patch.object(alert_router, "ssm", mock_ssm):
        assert alert_router._get_webhook_url() == ""


def test_handler_no_webhook():
    with patch.object(alert_router, "_get_webhook_url", return_value=""), patch.object(alert_router, "_post") as mock_post:
        response = alert_router.handler(_sns_event(), None)

    assert response["statusCode"] == 200
    mock_post.assert_not_called()


def test_handler_updates_maintenance_mode():
    mock_ssm = MagicMock()
    with patch.object(alert_router, "ssm", mock_ssm):
        response = alert_router.handler({"maintenance_mode": "true"}, None)

    assert response["statusCode"] == 200
    mock_ssm.put_parameter.assert_called_once()


def test_handler_suppresses_alerts_during_maintenance():
    with patch.object(alert_router, "_is_maintenance_mode", return_value=True), patch.object(alert_router, "_post") as mock_post:
        response = alert_router.handler(_sns_event(), None)

    assert response["statusCode"] == 200
    mock_post.assert_not_called()


def test_handler_routes_pagerduty():
    with patch.object(alert_router, "_get_webhook_url", return_value="https://events.pagerduty.com/v2/enqueue"), patch.object(alert_router, "_post") as mock_post:
        response = alert_router.handler(_sns_event("ALARM"), None)

    assert response["statusCode"] == 200
    assert mock_post.call_count == 1
    _, payload = mock_post.call_args.args
    assert payload["event_action"] == "trigger"


def test_handler_routes_slack():
    with patch.object(alert_router, "_get_webhook_url", return_value="https://hooks.slack.com/services/test"), patch.object(alert_router, "_post") as mock_post:
        response = alert_router.handler(_sns_event("ALARM"), None)

    assert response["statusCode"] == 200
    assert mock_post.call_count == 1
    _, payload = mock_post.call_args.args
    assert payload["attachments"][0]["color"] == "danger"


def test_post_http_error():
    error = HTTPError(
        url="https://example.com/webhook",
        code=500,
        msg="Internal Server Error",
        hdrs=None,
        fp=io.BytesIO(b"server error"),
    )

    with patch("alert_router.urllib.request.urlopen", side_effect=error):
        with pytest.raises(HTTPError):
            alert_router._post("https://example.com/webhook", {"ok": True})


def test_handler_multiple_records():
    event = {
        "Records": [
            {"Sns": {"Message": json.dumps({"AlarmName": "a1", "NewStateValue": "ALARM"})}},
            {"Sns": {"Message": json.dumps({"AlarmName": "a2", "NewStateValue": "OK"})}},
        ]
    }

    with patch.object(alert_router, "_get_webhook_url", return_value="https://hooks.slack.com/services/test"), patch.object(alert_router, "_post") as mock_post:
        response = alert_router.handler(event, None)

    assert response["statusCode"] == 200
    assert mock_post.call_count == 2


def test_handler_malformed_record():
    event = {
        "Records": [
            {"Sns": {"Message": "not-valid-json"}},
            {"Sns": {"Message": json.dumps({"AlarmName": "a2", "NewStateValue": "OK"})}},
        ]
    }

    with patch.object(alert_router, "_get_webhook_url", return_value="https://hooks.slack.com/services/test"), patch.object(alert_router, "_post") as mock_post:
        response = alert_router.handler(event, None)

    assert response["statusCode"] == 200
    assert mock_post.call_count == 1
