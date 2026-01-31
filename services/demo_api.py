#!/usr/bin/env python3
# services/demo_api.py
# Minimal FastAPI service exposing a protected /demo/report snapshot endpoint.
#
# Usage:
#   export DATABASE_URL=postgresql://...   # or provide --db-url
#   export DEMO_API_TOKEN=secret-token
#   uvicorn services.demo_api:app --host 0.0.0.0 --port 8080

from __future__ import annotations
import os
import io
from typing import Optional
from fastapi import FastAPI, Header, HTTPException, Query, Response
from fastapi.responses import HTMLResponse, JSONResponse, PlainTextResponse
from datetime import datetime, timezone

# Import helpers from scripts/generate_demo_report.py
# The script must be in PYTHONPATH (repo root) or use relative import adjustments.
from scripts.generate_demo_report import load_evidence_rows, aggregate, render_html

# Optional PDF rendering via weasyprint
try:
    from weasyprint import HTML as WeasyHTML
    WEASYPRINT = True
except Exception:
    WEASYPRINT = False

app = FastAPI(title="SecureBase Demo Snapshot API", version="0.1")

DEMO_TOKEN = os.getenv("DEMO_API_TOKEN")  # required for access
DB_URL = os.getenv("DATABASE_URL") or ""

def _check_token(token: Optional[str]):
    if not DEMO_TOKEN:
        # if token not set, deny by default for safety
        raise HTTPException(status_code=403, detail="Demo API not configured")
    if not token or token != DEMO_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid demo token")

@app.get("/demo/health")
def health():
    return {"status": "ok", "time": datetime.now(timezone.utc).isoformat()}

@app.get("/demo/report")
def demo_report(
    format: str = Query("html", regex="^(html|pdf|json|csv)$"),
    x_demo_token: Optional[str] = Header(None, convert_underscores=False),
    db_url: Optional[str] = Query(None),
):
    """
    Generate a snapshot report from evidence_records.
    - format: html (default), pdf, json, csv
    - Authorization: send header X-DEMO-TOKEN: <token> (set DEMO_API_TOKEN env var)
    - Optionally override DB URL with ?db_url=
    """
    # auth
    _check_token(x_demo_token)

    effective_db = db_url or DB_URL
    if not effective_db:
        raise HTTPException(status_code=500, detail="DATABASE_URL not configured")

    # load rows and aggregate
    try:
        rows = load_evidence_rows(effective_db)
        summary = aggregate(rows)
        context = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "source_info": {"title": "SecureBase Demo Snapshot"},
            "rows": rows,
            "summary": summary,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading evidence: {e}")

    if format == "json":
        return JSONResponse(content=rows)
    if format == "csv":
        # lightweight CSV generation
        import csv, tempfile
        out = io.StringIO()
        fieldnames = ["id","customer_id","control_id","framework","source_system","artifact_ref","last_collected","valid_until","status"]
        writer = csv.DictWriter(out, fieldnames=fieldnames)
        writer.writeheader()
        for r in rows:
            writer.writerow({k: r.get(k) for k in fieldnames})
        return PlainTextResponse(content=out.getvalue(), media_type="text/csv")

    # render HTML
    html = render_html(context)

    if format == "html":
        return HTMLResponse(content=html)
    if format == "pdf":
        if not WEASYPRINT:
            raise HTTPException(status_code=503, detail="PDF export not available (weasyprint not installed)")
        pdf_bytes = WeasyHTML(string=html).write_pdf()
        return Response(content=pdf_bytes, media_type="application/pdf")
    raise HTTPException(status_code=400, detail="Unsupported format")
