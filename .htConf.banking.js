const requestTypes = {
  HTTP: 'HTTP',
  AMQP: 'AMQP',
};

const serviceIdentifiers = require('./service-identifiers');


module.exports = {
  htBackendBaseUrl: 'https://demo.hypertest.co', // HyperTest backend URL (Required)
  serviceIdentifier: serviceIdentifiers.bankingService,
  requestTypesToTest: [requestTypes.HTTP], // What kind of requests to include in the test
  httpCandidateUrl: 'http://localhost:12300', // HTTP URL of App under test (Optional)
  appStartCommand: 'npm', // Command to start the app (Required)
  appStartCommandArgs: ['run', 'start:banking'], // App start command arguments (Required)
  appWorkingDirectory: __dirname, // Working directory for the app (default: current working dir) (Optional)
  appStartTimeoutSec: 20, // Timeout for the start command (default: 10) (Optional)
  showAppLogs: true, // Whether to show app logs (default: false) (Optional)
  testBatchSize: 50, // Number of concurrent test requests (default: 50) (Optional)
  // testRequestsLimit: 0, // Number requests to test (Optional)
  httpReqFiltersArr: [], // "<GET /users>", "<ANY REGEX:^/payments>" (Optional)
  htExtraHeaders: {  // Object containing additional headers for HyperTest server requests (Optional)
    // authorization: creds.authHeader,
  },
};

// 581, 573, 577, 580