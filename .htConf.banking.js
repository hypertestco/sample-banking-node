const requestTypes = {
  HTTP: 'HTTP',
  AMQP: 'AMQP',
};

const serviceIdentifiers = require('./service-identifiers');


module.exports = {
  htBackendBaseUrl: 'http://localhost:6010', // HyperTest backend URL (Required)
  serviceIdentifier: '473c8ef0-c130-48ba-8b55-0a875457fd4c',
  requestTypesToTest: [requestTypes.HTTP], // What kind of requests to include in the test
  httpCandidateUrl: 'http://localhost:12300', // HTTP URL of App under test (Optional)
  appStartCommand: 'npm', // Command to start the app (Required)
  appStartCommandArgs: ['run', 'start:banking'], // App start command arguments (Required)
  appWorkingDirectory: __dirname, // Working directory for the app (default: current working dir) (Optional)
  appStartTimeoutSec: 1000000, // Timeout for the start command (default: 10) (Optional)
  showAppLogs: true, // Whether to show app logs (default: false) (Optional)
  showAppStdErrLogs: true,
  testBatchSize: 50, // Number of concurrent test requests (default: 50) (Optional)
  // testRequestsLimit: 0, // Number requests to test (Optional)
  httpReqFiltersArr: [], // "<GET /users>", "<ANY REGEX:^/payments>" (Optional)
  htExtraHeaders: {  // Object containing additional headers for HyperTest server requests (Optional)
    // authorization: creds.authHeader,
  },
  shouldCaptureTestRequestCoverage: false,
  masterBranch: 'main'
};

// 581, 573, 577, 580