"""
Alert Router — SNS → PagerDuty/Opsgenie/Slack webhook

Triggered by SNS from CloudWatch alarms. Reads webhook URL from SSM,
formats the payload for the configured provider, and POSTs it.
"""
import json
import os
import logging
import urllib.request
import urllib.error
import boto3

logger = logging.getLogger(__name__)
logger.setLevel(os.environ.get("LOG_LEVEL", "INFO"))

ssm = boto3.client("ssm")
_webhook_cache = None


def _maintenance_param_name(env: str) -> str:
    return os.environ.get("MAINTENANCE_MODE_PARAM", f"/securebase/{env}/maintenance_mode")


def _set_maintenance_mode(param_name: str, enabled: str) -> None:
    ssm.put_parameter(Name=param_name, Value=enabled, Type="String", Overwrite=True)
    logger.info("Maintenance mode updated: %s=%s", param_name, enabled)


def _is_maintenance_mode(param_name: str) -> bool:
    try:
        value = ssm.get_parameter(Name=param_name)["Parameter"]["Value"].strip().lower()
        return value == "true"
    except Exception as e:
        logger.warning("Maintenance mode param unavailable (%s): %s", param_name, e)
        return False


def _get_webhook_url() -> str:
    global _webhook_cache
    if _webhook_cache:
        return _webhook_cache
    param = os.environ.get("WEBHOOK_SSM_PARAM", "/securebase/alerts/webhook_url")
    try:
        _webhook_cache = ssm.get_parameter(Name=param, WithDecryption=True)["Parameter"]["Value"]
        return _webhook_cache
    except Exception as e:
        logger.warning("Webhook URL SSM param not found (%s): %s", param, e)
        return ""


def _severity(state: str) -> str:
    return "critical" if state == "ALARM" else "info"


def _pagerduty_payload(alarm: dict, state: str, env: str) -> dict:
    return {
        "routing_key": "",  # set via webhook URL — integration key embedded
        "event_action": "trigger" if state == "ALARM" else "resolve",
        "dedup_key": alarm.get("AlarmName", ""),
        "payload": {
            "summary": alarm.get("AlarmDescription", alarm.get("AlarmName", "SecureBase Alert")),
            "severity": _severity(state),
            "source": f"securebase-{env}",
            "custom_details": {
                "alarm_name": alarm.get("AlarmName"),
                "state": state,
                "reason": alarm.get("NewStateReason", ""),
                "region": alarm.get("Region", ""),
                "account": alarm.get("AWSAccountId", ""),
            },
        },
    }


def _slack_payload(alarm: dict, state: str, env: str) -> dict:
    icon = ":red_circle:" if state == "ALARM" else ":large_green_circle:"
    return {
        "text": f"{icon} *[{env.upper()}] {alarm.get('AlarmName', 'Alert')}*",
        "attachments": [
            {
                "color": "danger" if state == "ALARM" else "good",
                "fields": [
                    {"title": "State", "value": state, "short": True},
                    {"title": "Region", "value": alarm.get("Region", ""), "short": True},
                    {"title": "Reason", "value": alarm.get("NewStateReason", ""), "short": False},
                ],
            }
        ],
    }


def _post(url: str, payload: dict) -> None:
    body = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            logger.info("Webhook delivered: status=%s", resp.status)
    except urllib.error.HTTPError as e:
        logger.error("Webhook HTTP error %s: %s", e.code, e.read())
        raise
    except urllib.error.URLError as e:
        logger.error("Webhook URL error: %s", e.reason)
        raise


def handler(event, _context):
    env = os.environ.get("ENVIRONMENT", "prod")
    maintenance_param = _maintenance_param_name(env)

    if "maintenance_mode" in event:
        _set_maintenance_mode(maintenance_param, str(event.get("maintenance_mode", "false")).lower())
        return {"statusCode": 200, "body": "maintenance mode updated"}

    if _is_maintenance_mode(maintenance_param):
        logger.info("Maintenance mode enabled — suppressing alert forwarding")
        return {"statusCode": 200, "body": "maintenance mode active"}

    webhook_url = _get_webhook_url()

    if not webhook_url:
        logger.warning("No webhook URL configured — alert dropped")
        return {"statusCode": 200, "body": "no webhook configured"}

    for record in event.get("Records", []):
        try:
            sns_msg = json.loads(record["Sns"]["Message"])
            state = sns_msg.get("NewStateValue", "ALARM")

            if "pagerduty" in webhook_url or "/v2/enqueue" in webhook_url:
                payload = _pagerduty_payload(sns_msg, state, env)
            else:
                payload = _slack_payload(sns_msg, state, env)

            _post(webhook_url, payload)
            logger.info("Alert routed: %s → %s", sns_msg.get("AlarmName"), state)
        except Exception as e:
            logger.error("Failed to route alert: %s", e)

    return {"statusCode": 200}
