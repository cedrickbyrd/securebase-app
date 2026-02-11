/**
 * SecureBase Email Worker Lambda
 * Processes SQS messages and sends emails via AWS SES
 * 
 * Expected SQS message format:
 * {
 *   "type": "WELCOME_EMAIL" | "INVOICE_EMAIL" | "PASSWORD_RESET" | "ALERT",
 *   "to": "user@example.com",
 *   "subject": "Welcome to SecureBase!",
 *   "html": "<h1>Hello User</h1>...",
 *   "text": "Hello User...",
 *   "replyTo": "support@tximhotep.com",
 *   "cc": ["manager@example.com"],
 *   "bcc": ["archive@tximhotep.com"],
 *   "tags": [
 *     { "Name": "customer_id", "Value": "cust_123" },
 *     { "Name": "email_type", "Value": "welcome" }
 *   ]
 * }
 */

const AWS = require('aws-sdk');
const ses = new AWS.SES({ region: process.env.SES_REGION || 'us-east-1' });

// Configuration from environment variables
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'noreply@tximhotep.com';
const CONFIGURATION_SET = process.env.CONFIGURATION_SET || 'securebase-email-tracking';

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
  console.log(`Processing ${event.Records.length} email messages`);
  
  const results = {
    succeeded: 0,
    failed: 0,
    errors: []
  };
  
  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.body);
      await sendEmail(message);
      results.succeeded++;
      console.log(`✅ Email sent successfully: ${message.type} to ${message.to}`);
    } catch (error) {
      results.failed++;
      results.errors.push({
        messageId: record.messageId,
        error: error.message,
        body: record.body
      });
      console.error(`❌ Failed to send email:`, error);
      console.error(`   Message body:`, record.body);
      
      // Re-throw to trigger SQS retry/DLQ
      throw error;
    }
  }
  
  console.log(`Batch complete: ${results.succeeded} succeeded, ${results.failed} failed`);
  
  return {
    statusCode: 200,
    body: JSON.stringify(results)
  };
};

/**
 * Send email via AWS SES
 */
async function sendEmail(message) {
  // Validate required fields
  validateMessage(message);
  
  const params = {
    Destination: {
      ToAddresses: Array.isArray(message.to) ? message.to : [message.to],
      CcAddresses: message.cc || [],
      BccAddresses: message.bcc || [],
    },
    Message: {
      Body: {
        Html: {
          Charset: "UTF-8",
          Data: message.html || `<p>${message.text}</p>`
        },
        Text: {
          Charset: "UTF-8",
          Data: message.text || stripHtml(message.html)
        }
      },
      Subject: {
        Charset: "UTF-8",
        Data: message.subject
      }
    },
    Source: SENDER_EMAIL,
    ReplyToAddresses: message.replyTo ? [message.replyTo] : ['support@tximhotep.com'],
    ConfigurationSetName: CONFIGURATION_SET,
  };
  
  // Add tags for tracking
  if (message.tags && message.tags.length > 0) {
    params.Tags = message.tags;
  }
  
  // Send via SES
  const result = await ses.sendEmail(params).promise();
  
  console.log(`SES MessageId: ${result.MessageId}`);
  
  return result;
}

/**
 * Validate message has required fields
 */
function validateMessage(message) {
  if (!message.to) {
    throw new Error('Missing required field: to');
  }
  if (!message.subject) {
    throw new Error('Missing required field: subject');
  }
  if (!message.html && !message.text) {
    throw new Error('Missing required field: html or text');
  }
}

/**
 * Strip HTML tags for plain text fallback
 */
function stripHtml(html) {
  if (!html) return '';
  let previous;
  let current = html;
  // Repeatedly remove HTML-like tags until no more are found
  do {
    previous = current;
    current = current.replace(/<[^>]*>/g, '');
  } while (current !== previous);
  return current.trim();
}
