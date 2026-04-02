const aws = require('@aws-sdk/client-ses');

const ses = new aws.SES({
  region: process.env.SES_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.SES_ACCESS_KEY_ID,
    secretAccessKey: process.env.SES_SECRET_ACCESS_KEY
  }
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const data = JSON.parse(event.body);
    const { email, company, message } = data;

    const notificationParams = {
      Source: process.env.SES_FROM_EMAIL || 'sales@tximhotep.com',
      Destination: {
        ToAddresses: [process.env.NOTIFICATION_EMAIL || 'cedrickjbyrd@gmail.com']
      },
      Message: {
        Subject: { Data: 'New SecureBase Early Access Request' },
        Body: {
          Text: {
            Data: `New lead submitted!

Email: ${email}
Company: ${company}
Message: ${message}

Submitted: ${new Date().toLocaleString()}`
          }
        }
      }
    };

    const autoReplyParams = {
      Source: process.env.SES_FROM_EMAIL || 'sales@tximhotep.com',
      Destination: {
        ToAddresses: [email]
      },
      Message: {
        Subject: { Data: 'Welcome to SecureBase Early Access' },
        Body: {
          Text: {
            Data: `Thank you for your interest in SecureBase!

We've received your request and will be in touch within 24 hours.

In the meantime:
- Try our live demo: https://demo.securebase.tximhotep.com/login
- Book a call: https://calendly.com/cedrickjbyrd/white-glove-pilot

Best regards,
SecureBase Team`
          }
        }
      }
    };

    // Send notification email (critical)
    await ses.sendEmail(notificationParams);

    // Try to send auto-reply (non-critical)
    try {
      await ses.sendEmail(autoReplyParams);
    } catch (autoReplyError) {
      console.error('Auto-reply failed (non-critical):', autoReplyError.message);
      // Continue - notification was sent successfully
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ success: true, message: 'Emails sent successfully' })
    };
  } catch (error) {
    console.error('Error sending email:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: error.message })
    };
  }
};
