import json, os
import boto3
import pg8000.native

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
    """
    Execute a SELECT query.
    Pass params as a list: execute("SELECT ... WHERE id=$1", [my_id])
    """
    conn = _conn()
    try:
        return conn.run(sql, *params) if params else conn.run(sql)
    finally:
        conn.close()

def execute_write(sql, params=None):
    """
    Execute an INSERT/UPDATE/DELETE.
    Pass params as a list: execute_write("INSERT ... VALUES($1,$2)", [val1, val2])
    """
    conn = _conn()
    try:
        conn.run(sql, *params) if params else conn.run(sql)
    finally:
        conn.close()
