# scripts/seed_post_seed_hooks.py
# Helper to generate a snapshot HTML file after the demo seed runs.
# Usage from seed_demo_data(): call generate_snapshot(output_path="exports/demo_snapshot.html")

import os
from typing import Optional
from scripts.generate_demo_report import load_evidence_rows, aggregate, render_html

def generate_snapshot(db_url: Optional[str] = None, out_path: str = "exports/demo_snapshot.html"):
    db = db_url or os.getenv("DATABASE_URL")
    if not db:
        raise RuntimeError("DATABASE_URL required to generate demo snapshot")

    rows = load_evidence_rows(db)
    summary = aggregate(rows)
    context = {
        "generated_at": None,
        "source_info": {"title": "SecureBase Demo Snapshot"},
        "rows": rows,
        "summary": summary,
    }
    html = render_html(context)
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"Wrote demo snapshot to {out_path}")
    return out_path
