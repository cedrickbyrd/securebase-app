#!/usr/bin/env node
/**
 * validate-pricing.js — "Unit Test for Revenue"
 *
 * Validates Stripe pricing configuration per market tier, scans for hardcoded
 * price IDs in source files, checks backend compliance metadata, and verifies
 * that no landing page auto-redirects to /pricing (route-guard integrity).
 *
 * Usage:
 *   node .github/scripts/validate-pricing.js <tier>
 *   node .github/scripts/validate-pricing.js all
 *
 * Tiers: standard | fintech | healthcare | government | all
 *
 * Exit codes:  0 = all checks passed   1 = one or more checks failed
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

// ─── ANSI colours ─────────────────────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  blue:   '\x1b[34m',
  cyan:   '\x1b[36m',
  bold:   '\x1b[1m',
};

const ok   = (msg) => console.log(`${C.green}✅ ${msg}${C.reset}`);
const fail = (msg) => console.error(`${C.red}❌ ${msg}${C.reset}`);
const info = (msg) => console.log(`${C.cyan}   ${msg}${C.reset}`);
const warn = (msg) => console.log(`${C.yellow}⚠️  ${msg}${C.reset}`);
const head = (msg) => console.log(`\n${C.bold}${C.blue}── ${msg} ──${C.reset}`);

// ─── Canonical pricing manifest (CI source of truth) ─────────────────────────
//
// Market Tier     | Price ID                         | Price  | Pilot  | Required Metadata
// ----------------+----------------------------------+--------+--------+------------------------------
// Standard/Pilot  | price_1Srgn65bg6XXXrmNXXXXXXXX  | $2,000 | $1,000 | internal_audit_enabled: true
// Fintech         | price_1SrgoQ5bg6XXXrmNwsdnTwrW  | $8,000 | $4,000 | compliance_framework: SOC2
// Healthcare      | price_1SrgoQ5bg6XXXrmNQvC2YnmT  | $15,000| $7,500 | compliance_framework: HIPAA
// Government      | price_1SrgoR5bg6XXXrmNUUveBMDw  | $25,000| $12,500| audit_signature: required
//
const MANIFEST = {
  standard: {
    priceId:    'price_1Srgn65bg6XXXrmNXXXXXXXX',
    price:      2000,
    pilotPrice: 1000,
    framework:  'CIS',
    compliance: { internal_audit_enabled: 'true' },
  },
  fintech: {
    priceId:    'price_1SrgoQ5bg6XXXrmNwsdnTwrW',
    price:      8000,
    pilotPrice: 4000,
    framework:  'SOC2',
    compliance: { compliance_framework: 'SOC2' },
  },
  healthcare: {
    priceId:    'price_1SrgoQ5bg6XXXrmNQvC2YnmT',
    price:      15000,
    pilotPrice: 7500,
    framework:  'HIPAA',
    compliance: { compliance_framework: 'HIPAA' },
  },
  government: {
    priceId:    'price_1SrgoR5bg6XXXrmNUUveBMDw',
    price:      25000,
    pilotPrice: 12500,
    framework:  'FedRAMP',
    compliance: { audit_signature: 'required' },
  },
};

// ─── Paths ────────────────────────────────────────────────────────────────────
const REPO_ROOT     = path.resolve(__dirname, '../..');
const CONFIG_PATH   = path.join(REPO_ROOT, 'phase3a-portal/src/config/live-config.js');
const BACKEND_PATH  = path.join(REPO_ROOT, 'phase2-backend/functions/create_checkout_session.py');
const PORTAL_SRC    = path.join(REPO_ROOT, 'phase3a-portal/src');
const ROOT_SRC      = path.join(REPO_ROOT, 'src');
const BACKEND_FUNCS = path.join(REPO_ROOT, 'phase2-backend/functions');

// ─── Config loader ────────────────────────────────────────────────────────────
/**
 * Parse PRICING_TIERS out of live-config.js using a vm sandbox so we can
 * evaluate the ES-module file without a full bundler.
 */
function loadPricingTiers() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`Pricing config not found: ${CONFIG_PATH}`);
  }

  let src = fs.readFileSync(CONFIG_PATH, 'utf8');

  // Strip ES-module syntax that Node's vm context cannot handle
  src = src
    .replace(/^import\s+.*?;\s*$/gm, '')                      // remove import statements
    .replace(/import\.meta\.env\.[A-Z0-9_]+/g, '"__ENV__"')   // replace Vite env refs
    .replace(/loadStripe\s*\([^)]*\)/g, 'null')                // stub loadStripe
    .replace(/^export\s*\{[\s\S]*?\};\s*$/m, '');              // remove export block

  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);

  if (!sandbox.PRICING_TIERS || typeof sandbox.PRICING_TIERS !== 'object') {
    throw new Error('PRICING_TIERS not found or is not an object in live-config.js');
  }
  return sandbox.PRICING_TIERS;
}

// ─── Per-tier validator ───────────────────────────────────────────────────────
function validateTier(tier, pricingTiers) {
  const expected = MANIFEST[tier];
  const actual   = pricingTiers[tier];
  const errors   = [];

  if (!actual) {
    errors.push(`Tier "${tier}" not found in PRICING_TIERS`);
    return errors;
  }

  if (actual.priceId !== expected.priceId) {
    errors.push(
      `priceId mismatch\n       expected  "${expected.priceId}"\n       received  "${actual.priceId}"`
    );
  }
  if (actual.price !== expected.price) {
    errors.push(
      `price mismatch → expected $${expected.price.toLocaleString()}, got $${(actual.price || 0).toLocaleString()}`
    );
  }
  if (actual.pilotPrice !== expected.pilotPrice) {
    errors.push(
      `pilotPrice mismatch → expected $${expected.pilotPrice.toLocaleString()}, got $${(actual.pilotPrice || 0).toLocaleString()}`
    );
  }
  return errors;
}

// ─── Backend compliance-metadata check ───────────────────────────────────────
/**
 * Verify that create_checkout_session.py contains every required compliance
 * metadata key for each tier (set via TIER_COMPLIANCE_METADATA).
 */
function checkBackendCompliance() {
  if (!fs.existsSync(BACKEND_PATH)) {
    warn(`Backend file not found – skipping compliance-metadata check:\n   ${BACKEND_PATH}`);
    return [];
  }

  const src    = fs.readFileSync(BACKEND_PATH, 'utf8');
  const errors = [];

  for (const [tier, spec] of Object.entries(MANIFEST)) {
    for (const key of Object.keys(spec.compliance)) {
      if (!src.includes(`'${key}'`) && !src.includes(`"${key}"`)) {
        errors.push(`[${tier}] missing compliance metadata key "${key}" in create_checkout_session.py`);
      }
    }
  }
  return errors;
}

// ─── Hardcoded price ID scanner ──────────────────────────────────────────────
const PRICE_ID_RE = /price_[0-9A-Za-z]{14,}/g;

function findHardcodedPriceIds() {
  const results = [];
  const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'deploy', '.next', 'coverage']);

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(full);
      } else if (/\.(js|jsx|ts|tsx|py)$/.test(entry.name)) {
        // Skip the two authoritative files
        if (full === CONFIG_PATH || full === BACKEND_PATH) continue;
        // Skip this script itself
        if (full === __filename) continue;

        const text = fs.readFileSync(full, 'utf8');
        let m;
        PRICE_ID_RE.lastIndex = 0;
        while ((m = PRICE_ID_RE.exec(text)) !== null) {
          const lineNo = text.slice(0, m.index).split('\n').length;
          results.push({
            file: path.relative(REPO_ROOT, full),
            line: lineNo,
            id:   m[0],
          });
        }
      }
    }
  }

  walk(PORTAL_SRC);
  walk(ROOT_SRC);
  walk(BACKEND_FUNCS);
  return results;
}

// ─── Route / auth-guard integrity ────────────────────────────────────────────
/**
 * Ensure no landing page automatically redirects visitors to /pricing
 * without a user interaction (e.g., bare useEffect redirect or
 * window.location assignment outside onClick).
 */
function checkAuthGuards() {
  const candidates = [
    path.join(PORTAL_SRC, 'pages/LandingPage.jsx'),
    path.join(PORTAL_SRC, 'pages/Landing.jsx'),
    path.join(PORTAL_SRC, 'pages/Landing.tsx'),
    path.join(ROOT_SRC,   'pages/LandingPage.jsx'),
    path.join(ROOT_SRC,   'pages/Landing.tsx'),
  ].filter(fs.existsSync);

  const errors = [];

  // Auto-redirect patterns: navigate('/pricing') inside useEffect, or
  // bare window.location assignment to /pricing
  const AUTO_NAVIGATE = /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{[^}]*navigate\(\s*['"]\/pricing['"]/s;
  const HARD_LOCATION = /window\.location(?:\.href)?\s*=\s*['"](?:\/pricing|[^'"]*\/pricing['"]\s*)/;

  for (const p of candidates) {
    const text = fs.readFileSync(p, 'utf8');
    if (AUTO_NAVIGATE.test(text)) {
      errors.push(`Automatic navigate('/pricing') in useEffect detected: ${path.relative(REPO_ROOT, p)}`);
    }
    if (HARD_LOCATION.test(text)) {
      errors.push(`window.location redirect to /pricing detected: ${path.relative(REPO_ROOT, p)}`);
    }
  }

  if (candidates.length === 0) {
    warn('No landing page files found — route-guard check skipped');
  }
  return errors;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function main() {
  const tierArg    = (process.argv[2] || 'all').toLowerCase();
  const allTiers   = Object.keys(MANIFEST);
  const tiersToRun = tierArg === 'all' ? allTiers : [tierArg];
  let   exitCode   = 0;

  console.log(
    `\n${C.bold}${C.blue}╔════════════════════════════════════════╗\n` +
    `║   SecureBase Stripe Pricing Validator  ║\n` +
    `╚════════════════════════════════════════╝${C.reset}`
  );
  console.log(`${C.cyan}   Tier(s): ${tiersToRun.join(', ')}${C.reset}`);

  // ── 1. Load config ──────────────────────────────────────────────────────────
  head('Loading pricing config');
  let pricingTiers;
  try {
    pricingTiers = loadPricingTiers();
    ok(`Loaded PRICING_TIERS from phase3a-portal/src/config/live-config.js`);
    info(`Tiers present: ${Object.keys(pricingTiers).join(', ')}`);
  } catch (err) {
    fail(`Failed to load pricing config: ${err.message}`);
    process.exit(1);
  }

  // ── 2. Per-tier price ID + amount validation ────────────────────────────────
  head(`Validating tier pricing`);
  for (const tier of tiersToRun) {
    if (!MANIFEST[tier]) {
      fail(`Unknown tier "${tier}". Valid tiers: ${allTiers.join(', ')}`);
      exitCode = 1;
      continue;
    }
    const errors = validateTier(tier, pricingTiers);
    if (errors.length) {
      fail(`[${tier.toUpperCase()}] FAILED — ${errors.length} error(s):`);
      errors.forEach((e) => console.error(`${C.red}       • ${e}${C.reset}`));
      exitCode = 1;
    } else {
      ok(`[${tier.toUpperCase()}] priceId · price · pilotPrice match manifest`);
      info(`framework: ${MANIFEST[tier].framework}  |  priceId: ${MANIFEST[tier].priceId}`);
    }
  }

  // ── 3. Backend compliance-metadata (full run only) ─────────────────────────
  if (tierArg === 'all') {
    head('Backend compliance-metadata check');
    const metaErrors = checkBackendCompliance();
    if (metaErrors.length) {
      fail(`Missing compliance metadata keys in create_checkout_session.py:`);
      metaErrors.forEach((e) => console.error(`${C.red}       • ${e}${C.reset}`));
      exitCode = 1;
    } else {
      ok('All per-tier compliance metadata keys present in checkout session');
    }
  }

  // ── 4. Hardcoded price ID scan ──────────────────────────────────────────────
  head('Scanning for hardcoded price IDs');
  const hardcoded = findHardcodedPriceIds();
  if (hardcoded.length) {
    fail(`Found ${hardcoded.length} hardcoded price ID(s) outside authoritative config:`);
    hardcoded.forEach(({ file, line, id }) =>
      console.error(`${C.red}       • ${file}:${line}  →  ${id}${C.reset}`)
    );
    info('All price IDs must be referenced from phase3a-portal/src/config/live-config.js');
    exitCode = 1;
  } else {
    ok('No hardcoded price IDs found outside live-config.js');
  }

  // ── 5. Route / auth-guard integrity ────────────────────────────────────────
  head('Route & auth-guard integrity');
  const guardErrors = checkAuthGuards();
  if (guardErrors.length) {
    fail('Automatic /pricing redirect detected — anonymous users must see the landing page:');
    guardErrors.forEach((e) => console.error(`${C.red}       • ${e}${C.reset}`));
    exitCode = 1;
  } else {
    ok('No automatic /pricing redirects in landing page(s)');
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  const bar = '─'.repeat(46);
  console.log(`\n${C.bold}${bar}${C.reset}`);
  if (exitCode === 0) {
    console.log(`${C.bold}${C.green}✅  All pricing validations PASSED${C.reset}\n`);
  } else {
    console.log(`${C.bold}${C.red}❌  Pricing validation FAILED — review errors above${C.reset}\n`);
  }
  process.exit(exitCode);
}

main();
