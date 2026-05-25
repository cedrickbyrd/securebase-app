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

      throw new Error(`Unhandled UpdateExpression in auth test harness: ${UpdateExpression}. Add support here if the auth handler introduces a new update pattern.`);
    }

    if (Key?.email || Key?.token) {
      const recordKey = Key.email || Key.token;
      const record = TableName === 'securebase-users'
        ? this.mockUsers.get(recordKey)
        : this.mockTokens.get(recordKey);
      return record ? { Item: { ...record } } : {};
    }

    throw new Error(`Unhandled DynamoDB input: ${JSON.stringify(command.input)}`);
  },
  sesSend() {
    return { MessageId: 'ses-mock' };
  },
};

process.env.JWT_SECRET = 'test-secret';
process.env.USERS_TABLE = 'securebase-users';
process.env.TOKENS_TABLE = 'securebase-tokens';

let handler;

before(async () => {
  ({ handler } = await import(pathToFileURL(path.join(__dirname, 'index.js')).href));
});

beforeEach(() => {
  state.mockUsers = new Map();
  state.mockTokens = new Map();
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
