// Artillery processor for custom functions
// Provides data generation and utilities for load tests

module.exports = {
  // Generate random email for testing
  generateEmail,
  // Generate random customer ID
  generateCustomerId,
  // Generate random string
  generateRandomString,
  // Before request hook
  beforeRequest,
  // After response hook
  afterResponse
};

function generateEmail(context, events, done) {
  const domains = ['example.com', 'test.com', 'loadtest.com'];
  const domain = domains[Math.floor(Math.random() * domains.length)];
  const username = `user${Math.floor(Math.random() * 10000)}`;
  
  context.vars.testEmail = `${username}@${domain}`;
  return done();
}

function generateCustomerId(context, events, done) {
  context.vars.customerId = `cust_${Math.random().toString(36).substring(7)}`;
  return done();
}

function generateRandomString(context, events, done) {
  context.vars.randomString = Math.random().toString(36).substring(7);
  return done();
}

function beforeRequest(requestParams, context, ee, next) {
  // Add timing information
  context.vars._startTime = Date.now();
  
  // Log request for debugging (if needed)
  if (process.env.DEBUG_REQUESTS === 'true') {
    console.log(`[${new Date().toISOString()}] ${requestParams.method} ${requestParams.url}`);
  }
  
  return next();
}

function afterResponse(requestParams, response, context, ee, next) {
  // Calculate request duration
  const duration = Date.now() - context.vars._startTime;
  
  // Emit custom metric
  ee.emit('customStat', {
    stat: 'request_duration',
    value: duration
  });
  
  // Log slow requests
  if (duration > 1000) {
    console.warn(`[SLOW REQUEST] ${requestParams.url} took ${duration}ms`);
  }
  
  // Log errors
  if (response.statusCode >= 400) {
    console.error(`[ERROR] ${requestParams.url} returned ${response.statusCode}`);
  }
  
  return next();
}
