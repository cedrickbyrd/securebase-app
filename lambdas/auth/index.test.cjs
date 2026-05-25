'use strict';

const assert = require('assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');
const { registerHooks } = require('node:module');
const { before, beforeEach, describe, test } = require('node:test');

const mockModules = {
  '@aws-sdk/client-dynamodb': `
    export class DynamoDBClient {
      async send(command) {
        return globalThis.__authTestState.ddbSend(command);
      }
    }
    export class GetItemCommand {
      constructor(input) {
        this.input = input;
      }
    }
    export class PutItemCommand {
      constructor(input) {
        this.input = input;
      }
    }
    export class UpdateItemCommand {
      constructor(input) {
        this.input = input;
      }
    }
  `,
  '@aws-sdk/util-dynamodb': `
    export const marshall = (value) => value;
    export const unmarshall = (value) => value;
  `,
  '@aws-sdk/client-ses': `
    export class SESClient {
      async send(command) {
        return globalThis.__authTestState.sesSend(command);
      }
    }
    export class SendEmailCommand {
      constructor(input) {
        this.input = input;
      }
    }
  `,
  bcryptjs: `
    export default {
      hash: async (password) => \`hash:\${password}\`,
      compare: async (password, hash) => hash === \`hash:\${password}\`,
    };
  `,
  jsonwebtoken: `
    export default {
      sign: (payload) => \`jwt:\${payload.sub}\`,
    };
  `,
  otplib: `
    export const authenticator = {
      verify: () => true,
      generateSecret: () => 'secret',
      keyuri: (email) => \`otpauth://\${email}\`,
    };
  `,
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (mockModules[specifier]) {
      return {
        shortCircuit: true,
        url: `data:text/javascript,${encodeURIComponent(mockModules[specifier])}`,
      };
    }

    return nextResolve(specifier, context);
  },
});

const state = globalThis.__authTestState = {
  mockUsers: new Map(),
  mockTokens: new Map(),
  ddbSend(command) {
    const { TableName, Key, Item, UpdateExpression, ExpressionAttributeValues } = command.input;

    if (Item) {
      if (TableName === 'securebase-users') {
        this.mockUsers.set(Item.email, { ...Item });
      } else {
        this.mockTokens.set(Item.token, { ...Item });
      }
      return {};
    }

    if (UpdateExpression) {
      if (TableName === 'securebase-tokens' && Key?.token) {
        const token = Key.token;
        const existingToken = this.mockTokens.get(token);
        if (!existingToken) {
          const error = new Error('Conditional check failed');
          error.name = 'ConditionalCheckFailedException';
          throw error;
        }
        this.mockTokens.set(token, { ...existingToken, used: true });
        return { Attributes: { ...this.mockTokens.get(token) } };
      }

      const email = Key?.email;
      if (!email) {
        throw new Error('Expected email key for user update');
      }

      const existing = this.mockUsers.get(email) || { email };
      const values = ExpressionAttributeValues || {};

      if (UpdateExpression.includes('first_login_at = :t')) {
        if (existing.first_login_at) {
          const error = new Error('Conditional check failed');
          error.name = 'ConditionalCheckFailedException';
          throw error;
        }
        this.mockUsers.set(email, { ...existing, first_login_at: values[':t'] });
        return {};
      }

      if (UpdateExpression.includes('failed_login_attempts = :zero')) {
        const updated = { ...existing, failed_login_attempts: values[':zero'] };
        delete updated.locked_until;
        this.mockUsers.set(email, updated);
        return {};
      }

      throw new Error(`Unsupported UpdateExpression pattern. Please add support for this update operation in the test mock. Pattern: ${UpdateExpression}`);
    }

    if (Key?.email || Key?.token) {
      const recordKey = Key.email || Key.token;
      const record = TableName === 'securebase-users'
        ? this.mockUsers.get(recordKey)
        : this.mockTokens.get(recordKey);
      return record ? { Item: { ...record } } : {};
    }

    throw new Error(`Unexpected DynamoDB command. Add support for this operation in the test mock. Input: ${JSON.stringify(command.input)}`);
  },
  sesSend(command) {
    this.sesCallCount = (this.sesCallCount || 0) + 1;
    return { MessageId: 'ses-mock' };
  },
};

process.env.JWT_SECRET = 'test-secret';
process.env.USERS_TABLE = 'securebase-users';
process.env.TOKENS_TABLE = 'securebase-tokens';
process.env.SUPPORT_EMAIL = 'custom-support@acme.com';

let handler;

before(async () => {
  ({ handler } = await import(pathToFileURL(path.join(__dirname, 'index.js')).href));
});

beforeEach(() => {
  state.mockUsers = new Map();
  state.mockTokens = new Map();
  state.sesCallCount = 0;
});

function makeEvent(pathname, body) {
  return {
    path: pathname,
    httpMethod: 'POST',
    body: JSON.stringify(body),
  };
}

describe('auth lambda email normalization', () => {
  test('register stores lowercase email when given mixed-case input', async () => {
    const response = await handler(makeEvent('/auth/register', {
      email: '  USER@Example.COM ',
      password: 'ValidPass123!',
    }));

    assert.equal(response.statusCode, 201);
    assert.equal(state.mockUsers.has('user@example.com'), true);
    assert.equal(state.mockUsers.has('  USER@Example.COM '), false);
    assert.equal(state.mockUsers.get('user@example.com').email, 'user@example.com');
  });

  test('login resolves existing lowercase user from mixed-case input', async () => {
    state.mockUsers.set('user@example.com', {
      email: 'user@example.com',
      password_hash: 'hash:ValidPass123!',
      role: 'user',
      mfa_enabled: false,
    });

    const response = await handler(makeEvent('/auth/login', {
      email: ' USER@Example.COM ',
      password: 'ValidPass123!',
    }));

    assert.equal(response.statusCode, 200);
    const payload = JSON.parse(response.body);
    assert.equal(payload.user.email, 'user@example.com');
    assert.equal(payload.token, 'jwt:user@example.com');
    assert.ok(state.mockUsers.get('user@example.com').first_login_at);
  });
});

describe('isValidEmail — ReDoS-safe validation', () => {
  test('register accepts a valid email', async () => {
    const response = await handler(makeEvent('/auth/register', {
      email: 'user@example.com',
      password: 'ValidPass123!',
    }));

    assert.equal(response.statusCode, 201);
  });

  test('register rejects email with no @ sign', async () => {
    const response = await handler(makeEvent('/auth/register', {
      email: 'notanemail',
      password: 'ValidPass123!',
    }));

    assert.equal(response.statusCode, 400);
    assert.equal(JSON.parse(response.body).message, 'Invalid email address');
  });

  test('register rejects email with no domain part', async () => {
    const response = await handler(makeEvent('/auth/register', {
      email: 'user@',
      password: 'ValidPass123!',
    }));

    assert.equal(response.statusCode, 400);
    assert.equal(JSON.parse(response.body).message, 'Invalid email address');
  });

  test('register rejects email containing spaces', async () => {
    const response = await handler(makeEvent('/auth/register', {
      email: 'user name@example.com',
      password: 'ValidPass123!',
    }));

    assert.equal(response.statusCode, 400);
    assert.equal(JSON.parse(response.body).message, 'Invalid email address');
  });

  test('login with ReDoS-style payload resolves quickly and safely', async () => {
    const start = Date.now();
    const response = await handler(makeEvent('/auth/login', {
      email: '!@!.!.!.!.!.!.!.!.!.!.!.',
      password: 'ValidPass123!',
    }));
    const elapsed = Date.now() - start;

    assert.ok(elapsed < 100);
    assert.ok(response.statusCode === 400 || response.statusCode === 401);
  });

  test('forgot-password rejects invalid email', async () => {
    const response = await handler(makeEvent('/auth/forgot-password', {
      email: '@@bad',
    }));

    assert.equal(response.statusCode, 400);
    assert.equal(JSON.parse(response.body).message, 'Invalid email address');
  });

  test('mfa/setup rejects invalid email', async () => {
    const response = await handler(makeEvent('/auth/mfa/setup', {
      email: 'no-at-sign',
    }));

    assert.equal(response.statusCode, 400);
    assert.equal(JSON.parse(response.body).message, 'Invalid email address');
  });
});

describe('forgotPassword — uniform 200 on DynamoDB failure', () => {
  test('returns 200 with standard message when token store fails for known user', async () => {
    state.mockUsers.set('known@example.com', {
      email: 'known@example.com',
      password_hash: 'hash:ValidPass123!',
      role: 'user',
      mfa_enabled: false,
    });

    const originalDdbSend = state.ddbSend;
    state.ddbSend = function ddbSendWithStoreTokenFailure(command) {
      if (
        command.input?.TableName === 'securebase-tokens' &&
        command.input?.Item?.type === 'reset'
      ) {
        throw new Error('simulated token storage failure');
      }
      return originalDdbSend.call(this, command);
    };

    try {
      const response = await handler(makeEvent('/auth/forgot-password', {
        email: 'known@example.com',
      }));

      assert.equal(response.statusCode, 200);
      assert.equal(JSON.parse(response.body).message, 'If that email exists, a reset link has been sent');
    } finally {
      state.ddbSend = originalDdbSend;
    }
  });

  test('still returns 200 with standard message for non-existent user', async () => {
    const response = await handler(makeEvent('/auth/forgot-password', {
      email: 'missing@example.com',
    }));

    assert.equal(response.statusCode, 200);
    assert.equal(JSON.parse(response.body).message, 'If that email exists, a reset link has been sent');
  });
});

describe('emailHtml — SUPPORT_EMAIL is configurable', () => {
  test('forgot-password email HTML uses SUPPORT_EMAIL env var', async () => {
    state.mockUsers.set('known@example.com', {
      email: 'known@example.com',
      password_hash: 'hash:ValidPass123!',
      role: 'user',
      mfa_enabled: false,
    });

    const capturedSesInputs = [];
    const originalSesSend = state.sesSend;
    state.sesSend = function sesSendCapture(command) {
      capturedSesInputs.push(command.input);
      this.sesCallCount = (this.sesCallCount || 0) + 1;
      return { MessageId: 'ses-captured' };
    };

    try {
      const response = await handler(makeEvent('/auth/forgot-password', {
        email: 'known@example.com',
      }));

      assert.equal(response.statusCode, 200);
      assert.equal(capturedSesInputs.length, 1);
      const html = capturedSesInputs[0].Message.Body.Html.Data;
      assert.ok(html.includes('custom-support@acme.com'));
      assert.ok(!html.includes('support@securebase.tximhotep.com'));
    } finally {
      state.sesSend = originalSesSend;
    }
  });
});

describe('resendInvite', () => {
  test('valid (expired) invite token issues a new invite and sends email', async () => {
    const expiredToken = 'expired-invite-token-abc123';
    const pastExpiry = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
    state.mockTokens.set(expiredToken, {
      token: expiredToken,
      email: 'user@example.com',
      type: 'invite',
      used: false,
      expiresAt: pastExpiry,
    });

    const response = await handler(makeEvent('/auth/invite/resend', { token: expiredToken }));

    assert.equal(response.statusCode, 200);
    assert.equal(JSON.parse(response.body).message, 'If a matching invite exists, a new link has been sent');

    // A new token should have been stored (different from the original)
    const allTokens = [...state.mockTokens.keys()];
    assert.ok(allTokens.length === 2, `Expected 2 tokens, got ${allTokens.length}`);
    const newToken = allTokens.find((t) => t !== expiredToken);
    assert.ok(newToken, 'New token should exist in mockTokens');
    const newRecord = state.mockTokens.get(newToken);
    assert.equal(newRecord.type, 'invite');
    assert.equal(newRecord.email, 'user@example.com');
    assert.equal(newRecord.used, false);

    // Email should have been sent
    assert.equal(state.sesCallCount, 1, 'Expected SES to be called once');
  });

  test('already-used invite token returns 200 without creating a new token (anti-enumeration)', async () => {
    const usedToken = 'used-invite-token-xyz';
    state.mockTokens.set(usedToken, {
      token: usedToken,
      email: 'user@example.com',
      type: 'invite',
      used: true,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    });

    const response = await handler(makeEvent('/auth/invite/resend', { token: usedToken }));

    assert.equal(response.statusCode, 200);
    assert.equal(JSON.parse(response.body).message, 'If a matching invite exists, a new link has been sent');

    // No new token should have been written
    assert.equal(state.mockTokens.size, 1, 'No new token should have been stored');

    // No email should have been sent
    assert.equal(state.sesCallCount, 0, 'SES should not have been called for used token');
  });

  test('missing token body returns 400', async () => {
    const response = await handler(makeEvent('/auth/invite/resend', {}));

    assert.equal(response.statusCode, 400);
    assert.equal(JSON.parse(response.body).message, 'Token required');
  });

  test('invite route stores token with 30-day TTL (720 hours)', async () => {
    const beforeSend = Math.floor(Date.now() / 1000);

    await handler(makeEvent('/auth/invite', { email: 'newuser@example.com' }));

    const afterSend = Math.floor(Date.now() / 1000);

    // Find the invite token that was stored
    const inviteRecord = [...state.mockTokens.values()].find((t) => t.type === 'invite');
    assert.ok(inviteRecord, 'An invite token should have been stored');

    const expectedTtlHours = 24 * 30; // 720 hours
    const expectedMin = beforeSend + expectedTtlHours * 3600;
    const expectedMax = afterSend  + expectedTtlHours * 3600;

    assert.ok(
      inviteRecord.expiresAt >= expectedMin && inviteRecord.expiresAt <= expectedMax + 60,
      `expiresAt ${inviteRecord.expiresAt} should be ~${expectedTtlHours}h from now (between ${expectedMin} and ${expectedMax + 60})`,
    );
  });
});
