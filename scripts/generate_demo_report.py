#!/usr/bin/env python3
"""
scripts/generate_demo_report.py

Generate a "demo climax" export/report from evidence_records.

- Connects to the DB (DATABASE_URL env var by default)
- Queries evidence_records
- Aggregates summary metrics (per-customer, per-framework counts, recent failures, representative evidence items)
- Renders HTML via Jinja2 template (templates/demo_report.html)
- Optionally writes PDF (via WeasyPrint), JSON, or CSV

Usage:
  DATABASE_URL=postgresql://... python scripts/generate_demo_report.py --out exports/demo_snapshot.html
  python scripts/generate_demo_report.py --format pdf --out exports/demo_snapshot.pdf
  python scripts/generate_demo_report.py --format json --out exports/demo_snapshot.json
"""

from __future__ import annotations
import os
import argparse
import json
from datetime import datetime, timezone
from collections import defaultdict
from typing import List, Dict, Any

from sqlalchemy import create_engine, text
from jinja2 import Environment, FileSystemLoader, select_autoescape

# Optional PDF support
try:
    from weasyprint import HTML
    WEASYPRINT_AVAILABLE = True
except Exception:
    WEASYPRINT_AVAILABLE = False

TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), "..", "templates")
TEMPLATE_NAME = "demo_report.html"

def load_evidence_rows(db_url: str) -> List[Dict[str, Any]]:
    engine = create_engine(db_url, future=True)
    with engine.connect() as conn:
        # Select the common columns expected in evidence_records
        q = text("""
            SELECT
                id,
                customer_id,
                control_id,
                framework,
                category,
                source_system,
                collection_method,
                artifact_ref,
                last_collected,
                valid_until,
                status,
                metadata,
                created_at
            FROM evidence_records
            ORDER BY customer_id NULLS LAST, framework NULLS LAST, last_collected DESC NULLS LAST
        """)
        result = conn.execute(q)
        rows = []
        for r in result:
            rows.append({
                "id": r["id"],
                "customer_id": r["customer_id"],
                "control_id": r["control_id"],
                "framework": r["framework"],
                "category": r["category"],
                "source_system": r["source_system"],
                "collection_method": r["collection_method"],
                "artifact_ref": r["artifact_ref"],
                "last_collected": (r["last_collected"].isoformat() if r["last_collected"] else None),
                "valid_until": (r["valid_until"].isoformat() if r["valid_until"] else None),
                "status": r["status"],
                "metadata": r["metadata"],
                "created_at": (r["created_at"].isoformat() if r["created_at"] else None),
            })
        return rows

def aggregate(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    summary = {
        "total_records": len(rows),
        "by_customer": {},
        "by_framework": {},
        "recent_failures": [],
    }

    by_customer = defaultdict(list)
    by_framework = defaultdict(list)
    failures = []

    for r in rows:
        by_customer[r["customer_id"]].append(r)
        by_framework[r["framework"]].append(r)
        if r["status"] and r["status"].lower() in ("fail", "failed", "error"):
            failures.append(r)

    summary["by_customer"] = {
        cid: {
            "count": len(items),
            "frameworks": {fw: len([i for i in items if i["framework"] == fw]) for fw in set(i["framework"] for i in items)},
            "latest": items[0] if items else None
        }
        for cid, items in by_customer.items()
    }

    summary["by_framework"] = {fw: len(items) for fw, items in by_framework.items()}

    failures_sorted = sorted(failures, key=lambda x: x.get("last_collected") or "", reverse=True)
    summary["recent_failures"] = failures_sorted[:10]

    return summary

def render_html(context: Dict[str, Any]) -> str:
    env = Environment(
        loader=FileSystemLoader(TEMPLATE_DIR),
        autoescape=select_autoescape(["html", "xml"])
    )
    tmpl = env.get_template(TEMPLATE_NAME)
    return tmpl.render(context)

def write_output(html: str, out_path: str, fmt: str):
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    if fmt == "html":
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(html)
        print(f"Wrote HTML report to {out_path}")
    elif fmt == "pdf":
        if not WEASYPRINT_AVAILABLE:
            raise RuntimeError("weasyprint not available; install with `pip install weasyprint` to enable PDF export")
        HTML(string=html).write_pdf(out_path)
        print(f"Wrote PDF report to {out_path}")
    else:
        raise ValueError("unsupported write format for HTML writer")

def write_json(rows: List[Dict[str, Any]], out_path: str):
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(rows, f, indent=2, default=str)
    print(f"Wrote JSON export to {out_path}")

def write_csv(rows: List[Dict[str, Any]], out_path: str):
    import csv
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    fieldnames = ["id","customer_id","control_id","framework","source_system","artifact_ref","last_collected","valid_until","status"]
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in rows:
            writer.writerow({k: r.get(k) for k in fieldnames})
    print(f"Wrote CSV export to {out_path}")

def build_context(rows: List[Dict[str, Any]], summary: Dict[str, Any], source_info: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_info": source_info,
        "rows": rows,
        "summary": summary,
    }

def main():
    parser = argparse.ArgumentParser(description="Generate demo report from evidence_records")
    parser.add_argument("--db-url", default=os.getenv("DATABASE_URL", ""), help="SQLAlchemy DB URL (or set DATABASE_URL)")
    parser.add_argument("--format", default="html", choices=["html","pdf","json","csv"], help="Export format")
    parser.add_argument("--out", required=True, help="Output file path")
    parser.add_argument("--title", default="SecureBase Demo Snapshot", help="Report title")
    args = parser.parse_args()

    db_url = args.db_url
    if not db_url:
        raise SystemExit("DATABASE_URL not provided; set env var or pass --db-url")

    rows = load_evidence_rows(db_url)
    summary = aggregate(rows)
    context = build_context(rows, summary, {"title": args.title})

    if args.format in ("html","pdf"):
        html = render_html(context)
        write_output(html, args.out, args.format)
    elif args.format == "json":
        write_json(rows, args.out)
    elif args.format == "csv":
        write_csv(rows, args.out)

if __name__ == "__main__":
    main()
