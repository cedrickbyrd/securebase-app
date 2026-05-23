'use strict';

const assert = require('assert/strict');
const { describe, test, beforeEach } = require('node:test');
const Module = require('module');

let currentStripeEvent = null;
let ddbCommands = [];
let lambdaCommands = [];
let sesCommands = [];
let ddbSendImpl = null;
let lambdaSendImpl = null;

class MockUpdateCommand {
  constructor(input) {
    this.input = input;
  }
}

class MockInvokeCommand {
  constructor(input) {
    this.input = input;
  }
}

class MockSendEmailCommand {
  constructor(input) {
    this.input = input;
  }
}

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'stripe') {
    return () => ({
      webhooks: {
        constructEvent: () => currentStripeEvent,
      },
      customers: {
        createBalanceTransaction: async () => ({ id: 'cbtxn_mock' }),
      },
      subscriptions: {
        create: async () => ({ id: 'sub_mock', trial_end: Math.floor(Date.now() / 1000) + 86400 }),
      },
    });
  }

  if (request === '@aws-sdk/client-ses') {
    return {
      SESClient: class SESClient {
        async send(command) {
          sesCommands.push(command.input);
          return { MessageId: 'ses_mock' };
        }
      },
      SendEmailCommand: MockSendEmailCommand,
    };
  }

  if (request === '@aws-sdk/client-dynamodb') {
    return {
      DynamoDBClient: class DynamoDBClient {},
    };
  }

  if (request === '@aws-sdk/lib-dynamodb') {
    return {
      DynamoDBDocumentClient: {
        from: () => ({
          send: async (command) => {
            ddbCommands.push(command.input);
            if (ddbSendImpl) return ddbSendImpl(command);
            return {};
          },
        }),
      },
      UpdateCommand: MockUpdateCommand,
    };
  }

  if (request === '@aws-sdk/client-lambda') {
    return {
      LambdaClient: class LambdaClient {
        async send(command) {
          lambdaCommands.push(command.input);
          if (lambdaSendImpl) return lambdaSendImpl(command);
          return { StatusCode: 202 };
        }
      },
      InvokeCommand: MockInvokeCommand,
    };
  }

  return originalLoad.call(this, request, parent, isMain);
};

process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_mock';
process.env.USERS_TABLE = 'securebase-users';
process.env.PROVISIONING_FUNCTION_NAME = 'securebase-provisioner';

const handler = require('./index.cjs').handler;

function makeWebhookEvent() {
  return {
    body: '{"id":"evt_mock"}',
    headers: { 'stripe-signature': 'sig_mock' },
  };
}

describe('securebase-stripe-webhook checkout post-payment state handling', () => {
  beforeEach(() => {
    ddbCommands = [];
    lambdaCommands = [];
    sesCommands = [];
    ddbSendImpl = null;
    lambdaSendImpl = null;
  });

  test('successful checkout updates user state and queues provisioning invocation', async () => {
    currentStripeEvent = {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          customer: 'cus_test_123',
          metadata: {
            company_email: 'USER@Example.COM',
            plan: 'Fintech Pilot',
            tier: 'fintech',
            upgrade_to: 'fintech',
            assessment_credit: '495',
          },
          customer_details: { email: 'fallback@example.com' },
        },
      },
    };

    const response = await handler(makeWebhookEvent(), {});

    assert.equal(response.statusCode, 200);
    assert.equal(ddbCommands.length, 1);
    assert.equal(lambdaCommands.length, 1);

    const ddb = ddbCommands[0];
    assert.equal(ddb.TableName, 'securebase-users');
    assert.equal(ddb.Key.email, 'user@example.com');
    assert.equal(ddb.ExpressionAttributeValues[':status'], 'pro');
    assert.equal(ddb.ExpressionAttributeValues[':plan'], 'fintech_pilot');
    assert.equal(ddb.ExpressionAttributeValues[':tier'], 'fintech');
    assert.equal(ddb.ExpressionAttributeValues[':assessment_credit'], 495);
    assert.equal(ddb.ExpressionAttributeValues[':provisioning_status'], 'queued');

    const invoke = lambdaCommands[0];
    assert.equal(invoke.FunctionName, 'securebase-provisioner');
    assert.equal(invoke.InvocationType, 'Event');
    const payload = JSON.parse(invoke.Payload);
    assert.equal(payload.company_email, 'user@example.com');
    assert.equal(payload.tier, 'fintech');
    assert.equal(payload.plan, 'fintech_pilot');
  });

  test('missing metadata falls back deterministically to standard tier/plan', async () => {
    currentStripeEvent = {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_nometa',
          customer: 'cus_test_nometa',
          metadata: {},
          customer_details: { email: 'fallback@example.com' },
        },
      },
    };

    const response = await handler(makeWebhookEvent(), {});

    assert.equal(response.statusCode, 200);
    assert.equal(ddbCommands.length, 1);
    const ddb = ddbCommands[0];
    assert.equal(ddb.Key.email, 'fallback@example.com');
    assert.equal(ddb.ExpressionAttributeValues[':plan'], 'standard');
    assert.equal(ddb.ExpressionAttributeValues[':tier'], 'standard');
    assert.equal(ddb.ExpressionAttributeValues[':assessment_credit'], 0);
  });

  test('provisioning invocation path uses async event invocation', async () => {
    currentStripeEvent = {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_async',
          customer: 'cus_test_async',
          metadata: {
            company_email: 'async@example.com',
            plan: 'Government',
            tier: 'government',
          },
          customer_details: { email: 'fallback@example.com' },
        },
      },
    };

    const response = await handler(makeWebhookEvent(), {});

    assert.equal(response.statusCode, 200);
    assert.equal(lambdaCommands.length, 1);
    assert.equal(lambdaCommands[0].InvocationType, 'Event');
  });

  test('provisioning failure does not fail webhook acknowledgment', async () => {
    lambdaSendImpl = async () => {
      throw new Error('invoke failed');
    };
    currentStripeEvent = {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_prov_fail',
          customer: 'cus_test_prov_fail',
          metadata: {
            company_email: 'provfail@example.com',
            plan: 'Standard',
            tier: 'standard',
          },
          customer_details: { email: 'provfail@example.com' },
        },
      },
    };

    const response = await handler(makeWebhookEvent(), {});

    assert.equal(response.statusCode, 200);
    assert.equal(ddbCommands.length, 1);
    assert.equal(lambdaCommands.length, 1);
  });
});
