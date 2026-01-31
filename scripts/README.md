# Scripts Directory

This directory contains automation scripts for SecureBase operations.

## Demo snapshot API & auto-generation

A small HTTP endpoint is available to generate demo snapshots on demand:

- services/demo_api.py exposes GET /demo/report
- Secure with env var: export DEMO_API_TOKEN="your-token"
- Start: uvicorn services.demo_api:app --host 0.0.0.0 --port 8080

Seed integration:
- After running seed_demo_data(), call scripts/seed_post_seed_hooks.generate_snapshot() (or run the CLI)
- The seed flow will write exports/demo_snapshot.html which is ready for demos

Security:
- Set DEMO_API_TOKEN and restrict access (IP allow-list), or run behind an auth proxy in public environments.
