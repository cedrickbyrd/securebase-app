/**
 * post-whale-alert.cjs
 *
 * Netlify serverless function — fires when a named prospect ("whale") hits
 * their personalised demo URL (?prospect=veritexbank).
 *
 * Called by the useProspect hook on the frontend.  Returns 200 immediately;
 * all side-effects (Slack, optional email) are best-effort.
 *
 * POST body (JSON):
 *   { prospect, company, framework, industry, contactFirst, contactLast,
 *     contactTitle, demoUrl, referrer, timestamp }
 *
 * Required env vars:
 *   SLACK_WHALE_WEBHOOK_URL  — dedicated #whale-alerts Slack incoming webhook
 *   SLACK_WEBHOOK_URL        — fallback to existing security-alerts webhook
 */

const fetch = require('node-fetch');

// Industry → emoji for quick visual scanning in Slack.
const INDUSTRY_EMOJI = {
  banking:    '🏦',
  healthcare: '🏥',
  saas:       '💻',
  ai_ml:      '🤖',
  fedramp:    '🏛️',
};

// Framework → urgency label.
const FRAMEWORK_URGENCY = {
  FFIEC:   'REGULATORY EXAM RISK',
  HIPAA:   'PHI BREACH LIABILITY',
  SOC2:    'CUSTOMER AUDIT PENDING',
  FedRAMP: 'FEDERAL CONTRACT AT STAKE',
};

exports.handler = async (event) => {
  // Only accept POST from same origin or our demo subdomain.
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const {
    prospect      = 'unknown',
    company       = 'Unknown Company',
    framework     = '',
    industry      = '',
    contactFirst  = '',
    contactLast   = '',
    contactTitle  = '',
    demoUrl       = '',
    referrer      = '',
    timestamp     = new Date().toISOString(),
  } = body;

  const emoji    = INDUSTRY_EMOJI[industry] || '🎯';
  const urgency  = FRAMEWORK_URGENCY[framework] || framework;
  const contact  = [contactFirst, contactLast].filter(Boolean).join(' ') || 'Unknown contact';
  const title    = contactTitle || 'Decision-maker';

  const webhookUrl =
    process.env.SLACK_WHALE_WEBHOOK_URL ||
    process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.error('post-whale-alert: no Slack webhook URL configured');
    // Still return 200 so the frontend doesn't surface an error to the prospect.
    return { statusCode: 200, body: JSON.stringify({ sent: false, reason: 'no_webhook' }) };
  }

  const slackPayload = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} WHALE ALERT — ${company}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Company:*\n${company}` },
          { type: 'mrkdwn', text: `*Framework:*\n${urg