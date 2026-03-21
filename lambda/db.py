import json, os, logging
import boto3
import pg8000.native
from pg8000.exceptions import DatabaseError

logger = logging.getLogger()
_sm = boto3.client("secretsmanager")
_creds_cache = {}

def _creds():
    arn = os.environ["DB_SECRET_ARN"]
    if arn not in _creds_cache:
        _creds_cache[arn] = json.loads(_sm.get_secret_value(SecretId=arn)["SecretString"])
    return _creds_cache[arn]

def _conn():
    c = _creds()
    return pg8000.native.Connection(
        host=os.environ.get("DB_HOST", c.get("host")),
        port=int(c.get("port", 5432)),
        database=os.environ.get("DB_NAME", c.get("dbname", "securebase")),
        user=c["username"],
        password=c["password"],
        ssl_context=True,
    )

def execute(sql, params=None):
    conn = _conn()
    try:
        result = conn.run(sql, **params) if params else conn.run(sql)
        logger.debug(f"Query executed successfully")
        return result
    except DatabaseError as e:
        logger.error(f"Database error: {e}")
        raise
    finally:
        conn.close()

def execute_write(sql, params=None):
    conn = _conn()
    try:
        conn.run(sql, **params) if params else conn.run(sql)
        logger.debug(f"Write executed successfully")
    except DatabaseError as e:
        logger.error(f"Database error: {e}")
        raise
    finally:
        conn.close()
