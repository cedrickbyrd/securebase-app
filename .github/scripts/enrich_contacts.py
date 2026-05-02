#!/usr/bin/env python3
"""
SecureBase Contact Enrichment Pipeline
Reads companies.json and enriches each contact using:
  - Hunter.io domain search  (/v2/domain-search)
  - Hunter.io email finder   (/v2/email-finder)
  - People Data Labs person enrichment (/v5/person/enrich)

Outputs enriched_leads.json with personalized LinkedIn DMs and demo URLs.

Required env vars:
  HUNTER_API_KEY   - https://hunter.io/api-keys (free tier)
  PDL_API_KEY      - https://dashboard.peopledatalabs.com (free, 100 records/mo)
"""

import json
import os
import time
from datetime import datetime, timezone

import requests

# ── Constants ──────────────────────────────────────────────────────────────────

HUNTER_API_KEY = os.environ.get("HUNTER_API_KEY", "")
PDL_API_KEY = os.environ.get("PDL_API_KEY", "")

COMPANIES_FILE = ".github/data/companies.json"
OUTPUT_FILE = ".github/data/enriched_leads.json"

SENDER = os.environ.get(
    "ENRICHMENT_SENDER_IDENTITY",
    "Cedrick Byrd | Principal Cloud Architect | U.S. Army Veteran | SecureBase | Dallas, TX",
)

RATE_LIMIT_SLEEP = 0.5  # seconds between API calls

# ── LinkedIn DM Templates ──────────────────────────────────────────────────────

LINKEDIN_TEMPLATES = {
    "FFIEC": lambda contact: (
        f"Hi {contact['contact_first']},\n\n"
        "I'm a local Dallas founder building SecureBase — a compliance orchestration "
        "platform built specifically for Texas regional banks. We've automated FFIEC gap "
        "mapping and can deliver a 72-hour snapshot your team can act on immediately, "
        "without a 6-month implementation.\n\n"
        f"For {contact['company']}, that means closing audit findings faster and reducing "
        "examiner prep time significantly.\n\n"
        "Would you be open to a 20-minute call this week?\n\n"
        f"— {SENDER}"
    ),
    "HIPAA": lambda contact: (
        f"Hi {contact['contact_first']},\n\n"
        "I'm a Dallas-based founder building SecureBase — a HIPAA compliance automation "
        "platform built on AWS. We map your controls directly to HIPAA §164 safeguards "
        "and surface gaps within 72 hours, not 6 months.\n\n"
        f"For organizations like {contact['company']}, teams typically see a 60% reduction "
        "in audit prep time.\n\n"
        "I'd love to show you a live demo tailored for your environment. Are you free this week?\n\n"
        f"— {SENDER}"
    ),
    "SOC2": lambda contact: (
        f"Hi {contact['contact_first']},\n\n"
        "I'm a Dallas founder building SecureBase — a compliance automation platform for "
        "SaaS teams pursuing SOC 2. We automate evidence collection and continuous control "
        "monitoring on AWS, cutting audit prep from months to days.\n\n"
        f"Given {contact['company']}'s scale, I think we could save your team significant "
        "time before your next audit cycle.\n\n"
        "Would you be open to a quick demo?\n\n"
        f"— {SENDER}"
    ),
    "FedRAMP": lambda contact: (
        f"Hi {contact['contact_first']},\n\n"
        "I'm a U.S. Army Veteran and Dallas founder building SecureBase — a FedRAMP "
        "compliance automation platform on AWS. We accelerate ATO timelines by automating "
        "NIST 800-53 control mapping, evidence collection, and continuous monitoring.\n\n"
        f"For {contact['company']}, this means a faster path to FedRAMP authorization "
        "without scaling up your compliance team.\n\n"
        "Would you be interested in a 20-minute walkthrough?\n\n"
        f"— {SENDER}"
    ),
}

DEFAULT_TEMPLATE = lambda contact: (
    f"Hi {contact['contact_first']},\n\n"
    "I'm a Dallas founder building SecureBase — an AWS compliance automation platform "
    "for regulated industries. We help teams reduce audit prep time by 60% through "
    "automated control monitoring and evidence collection.\n\n"
    f"I'd love to show you what we've built for organizations like {contact['company']}.\n\n"
    f"— {SENDER}"
)


# ── API Helpers ────────────────────────────────────────────────────────────────

def hunter_domain_search(domain: str) -> dict:
    """Call Hunter.io /v2/domain-search. Returns email pattern and known emails."""
    if not HUNTER_API_KEY:
        print("  ⚠️  HUNTER_API_KEY not set — skipping domain search")
        return {}
    try:
        resp = requests.get(
            "https://api.hunter.io/v2/domain-search",
            params={"domain": domain, "api_key": HUNTER_API_KEY},
            timeout=15,
        )
        time.sleep(RATE_LIMIT_SLEEP)
        if resp.status_code == 200:
            data = resp.json().get("data", {})
            return {
                "email_pattern": data.get("pattern", ""),
                "organization": data.get("organization", ""),
                "emails_found": [
                    {"value": e.get("value"), "confidence": e.get("confidence")}
                    for e in data.get("emails", [])[:3]
                ],
            }
        print(f"  ⚠️  Hunter domain search returned {resp.status_code} for {domain}")
    except Exception as exc:
        print(f"  ⚠️  Hunter domain search error for {domain}: {exc}")
    return {}


def hunter_email_finder(first: str, last: str, domain: str) -> dict:
    """Call Hunter.io /v2/email-finder. Returns verified email and confidence."""
    if not HUNTER_API_KEY:
        print("  ⚠️  HUNTER_API_KEY not set — skipping email finder")
        return {}
    try:
        resp = requests.get(
            "https://api.hunter.io/v2/email-finder",
            params={
                "first_name": first,
                "last_name": last,
                "domain": domain,
                "api_key": HUNTER_API_KEY,
            },
            timeout=15,
        )
        time.sleep(RATE_LIMIT_SLEEP)
        if resp.status_code == 200:
            data = resp.json().get("data", {})
            return {
                "email": data.get("email", ""),
                "score": data.get("score", 0),
                "verification_status": data.get("verification", {}).get("status", ""),
            }
        print(f"  ⚠️  Hunter email finder returned {resp.status_code} for {first} {last}@{domain}")
    except Exception as exc:
        print(f"  ⚠️  Hunter email finder error for {first} {last}: {exc}")
    return {}


def pdl_person_enrich(first: str, last: str, company: str) -> dict:
    """Call PDL /v5/person/enrich. Returns LinkedIn URL, title, seniority."""
    if not PDL_API_KEY:
        print("  ⚠️  PDL_API_KEY not set — skipping PDL enrichment")
        return {}
    try:
        resp = requests.get(
            "https://api.peopledatalabs.com/v5/person/enrich",
            params={
                "first_name": first,
                "last_name": last,
                "company": company,
                "pretty": True,
            },
            headers={"X-Api-Key": PDL_API_KEY},
            timeout=15,
        )
        time.sleep(RATE_LIMIT_SLEEP)
        if resp.status_code == 200:
            data = resp.json()
            return {
                "linkedin_url": data.get("linkedin_url", ""),
                "job_title": data.get("job_title", ""),
                "job_title_role": data.get("job_title_role", ""),
                "job_title_levels": data.get("job_title_levels", []),
            }
        if resp.status_code == 404:
            print(f"  ℹ️  PDL: no record found for {first} {last} at {company}")
        else:
            print(f"  ⚠️  PDL returned {resp.status_code} for {first} {last} at {company}")
    except Exception as exc:
        print(f"  ⚠️  PDL enrichment error for {first} {last}: {exc}")
    return {}


# ── Demo URL Builder ───────────────────────────────────────────────────────────

def build_demo_url(contact: dict) -> str:
    """Generate a personalized demo URL per contact."""
    industry = contact.get("industry", "").replace(" ", "_").lower()
    framework = contact.get("framework", "").replace(" ", "_").lower()
    company = contact.get("company", "").replace(" ", "_").replace("'", "")
    return (
        f"https://demo.securebase.tximhotep.com"
        f"?persona={industry}&framework={framework}&company={company}"
    )


# ── LinkedIn DM Builder ───────────────────────────────────────────────────────

def build_linkedin_dm(contact: dict) -> str:
    """Generate a personalized LinkedIn DM based on compliance framework."""
    framework = contact.get("framework", "")
    first = contact.get("contact_first", "")

    # Don't generate a real DM if name is not filled in yet
    if first == "FILL_IN":
        return (
            f"[Name needed] Template: {framework} outreach for {contact.get('company', '')}. "
            "Fill in contact_first/contact_last in companies.json to generate a personalized DM."
        )

    template_fn = LINKEDIN_TEMPLATES.get(framework, DEFAULT_TEMPLATE)
    return template_fn(contact)


# ── Main Enrichment Loop ───────────────────────────────────────────────────────

def enrich_contacts():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.abspath(os.path.join(script_dir, "..", ".."))

    companies_path = os.path.join(repo_root, COMPANIES_FILE)
    output_path = os.path.join(repo_root, OUTPUT_FILE)

    try:
        with open(companies_path) as f:
            companies = json.load(f)
    except FileNotFoundError:
        print(f"❌ companies.json not found at {companies_path}")
        print("   Expected path: .github/data/companies.json (relative to repo root)")
        raise
    except json.JSONDecodeError as exc:
        print(f"❌ Invalid JSON in {companies_path}: {exc}")
        raise

    enriched = []
    total = len(companies)
    needs_names = 0

    print(f"🔍 Enriching {total} contacts from companies.json\n")

    for i, contact in enumerate(companies, 1):
        company_name = contact.get("company", "")
        domain = contact.get("domain", "")
        first = contact.get("contact_first", "")
        last = contact.get("contact_last", "")
        has_name = first != "FILL_IN" and last != "FILL_IN"

        print(f"[{i}/{total}] {company_name} ({domain})")

        result = {**contact}

        # 1. Hunter domain search (always — pattern is useful even without a name)
        if domain:
            print(f"  → Hunter domain search: {domain}")
            domain_data = hunter_domain_search(domain)
            result["hunter_domain"] = domain_data
        else:
            result["hunter_domain"] = {}

        # 2. Hunter email finder (only if we have a real name)
        if has_name and domain:
            print(f"  → Hunter email finder: {first} {last} @ {domain}")
            email_data = hunter_email_finder(first, last, domain)
            result["hunter_email"] = email_data
        else:
            result["hunter_email"] = {}
            if not has_name:
                needs_names += 1

        # 3. PDL person enrichment (only if we have a real name)
        if has_name:
            print(f"  → PDL enrichment: {first} {last} at {company_name}")
            pdl_data = pdl_person_enrich(first, last, company_name)
            result["pdl_enrichment"] = pdl_data
        else:
            result["pdl_enrichment"] = {}

        # 4. Generate demo URL
        result["demo_url"] = build_demo_url(contact)

        # 5. Generate LinkedIn DM
        result["linkedin_dm"] = build_linkedin_dm(contact)

        enriched.append(result)
        print()

    # Write output
    output = {
        "generated": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "total": total,
            "enriched": total - needs_names,
            "needs_names": needs_names,
        },
        "leads": enriched,
    }

    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)

    print(f"✅ Wrote {output_path}")
    print(f"\n📊 Summary: {total - needs_names} enriched, {needs_names} need names")

    return output


if __name__ == "__main__":
    enrich_contacts()
