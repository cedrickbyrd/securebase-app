'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { describe, test } = require('node:test');

const sourcePath = path.join(__dirname, 'index.js');
const source = fs.readFileSync(sourcePath, 'utf8')
  .replace(/^import .*$/gm, '')
  .replace('export const handler = async (event) => {', 'const handler = async (event) => {');

function createHarness(initialUsers = {}) {
  const users = new Map(
    Object.entries(initialUsers).map(([email, user]) => [email, { ...user }]),
  );
  const tokens = new Map();

  class GetItemCommand {
    constructor(input) {
      this.input = input;
    }
  }

  class PutItemCommand {
    constructor(input) {
      this.input = input;
    }
  }

  class UpdateItemCommand {
    constructor(input) {
      this.input = input;
    }
  }

  class DynamoDBClient {
    async send(command) {
      if (command instanceof GetItemCommand) {
        const key = command.input.Key.email || command.input.Key.token;
        const item = command.input.TableName === 'securebase-users'
          ? users.get(key)
          : tokens.get(key);
        return item ? { Item: { ...item } } : {};
      }

      if (command instanceof PutItemCommand) {
        if (command.input.TableName === 'securebase-users') {
          users.set(command.input.Item.email, { ...command.input.Item });
        } else {
          tokens.set(command.input.Item.token, { ...command.input.Item });
        }
        return {};
      }

      if (command instanceof UpdateItemCommand) {
        const email = command.input.Key.email;
        const existing = users.get(email) || { email };
        const values = command.input.ExpressionAttributeValues || {};
        const expression = command.input.UpdateExpression;

        if (expression === 'SET failed_login_attempts = :zero REMOVE locked_until') {
          users.set(email, { ...existing, failed_login_attempts: values[':zero'] });
          return {};
        }

        if (expression === 'SET first_login_at = :t') {
          if (existing.first_login_at) {
            const error = new Error('Conditional check failed');
            error.name = 'ConditionalCheckFailedException';
            throw error;
          }
          users.set(email, { ...existing, first_login_at: values[':t'] });
          return {};
        }

        throw new Error(`Unhandled UpdateExpression in test harness: ${expression}`);
      }

      throw new Error(`Unhandled command type: ${command.constructor.name}`);
    }
  }

  class SESClient {
    async send() {
      return { MessageId: 'ses-mock' };
    }
  }

  class SendEmailCommand {
    constructor(input) {
      this.input = input;
    }
  }

  const bcrypt = {
    hash: async (password) => `hash:${password}`,
    compare: async (password, hash) => hash === `hash:${password}`,
  };

  const jwt = {
    sign: (payload) => `jwt:${payload.sub}`,
  };

  const authenticator = {
    verify: () => true,
    generateSecret: () => 'secret',
    keyuri: (email) => `otpauth://${email}`,
  };

  const crypto = {
    randomBytes: () => ({ toString: () => 'mock-token' }),
  };

  const moduleFactory = new Function(
    'DynamoDBClient',
    'GetItemCommand',
    'PutItemCommand',
    'UpdateItemCommand',
    'marshall',
    'unmarshall',
    'SESClient',
    'SendEmailCommand',
    'bcrypt',
    'jwt',
    'authenticator',
    'crypto',
    'process',
    'console',
    `${source}\nreturn { handler };`,
  );

  process.env.JWT_SECRET = 'test-secret';
  process.env.USERS_TABLE = 'securebase-users';
  process.env.TOKENS_TABLE = 'securebase-tokens';

  const { handler } = moduleFactory(
    DynamoDBClient,
    GetItemCommand,
    PutItemCommand,
    UpdateItemCommand,
    (value) => value,
    (value) => value,
    SESClient,
    SendEmailCommand,
    bcrypt,
    jwt,
    authenticator,
    crypto,
    process,
    console,
  );

  return { handler, users };
}

function makeEvent(pathname, body) {
  return {
    path: pathname,
    httpMethod: 'POST',
    body: JSON.stringify(body),
  };
}

describe('auth lambda email normalization', () => {
  test('register stores lowercase email when given mixed-case input', async () => {
    const { handler, users } = createHarness();

    const response = await handler(makeEvent('/auth/register', {
      email: '  USER@Example.COM ',
      password: 'ValidPass123!',
    }));

    assert.equal(response.statusCode, 201);
    assert.equal(users.has('user@example.com'), true);
    assert.equal(users.has('  USER@Example.COM '), false);
    assert.equal(users.get('user@example.com').email, 'user@example.com');
  });

  test('login resolves existing lowercase user from mixed-case input', async () => {
    const { handler, users } = createHarness({
      'user@example.com': {
        email: 'user@example.com',
        password_hash: 'hash:ValidPass123!',
        role: 'user',
        mfa_enabled: false,
      },
    });

    const response = await handler(makeEvent('/auth/login', {
      email: ' USER@Example.COM ',
      password: 'ValidPass123!',
    }));

    assert.equal(response.statusCode, 200);
    const payload = JSON.parse(response.body);
    assert.equal(payload.user.email, 'user@example.com');
    assert.equal(payload.token, 'jwt:user@example.com');
    assert.ok(users.get('user@example.com').first_login_at);
  });
});
