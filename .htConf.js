// eslint-disable-next-line @typescript-eslint/no-require-imports,@typescript-eslint/no-var-requires
const path = require('path');
const creds = require('./creds');

const requestTypes = {
    HTTP: 'HTTP',
    GRAPHQL: 'GRAPHQL'
};

module.exports = {
    htBackendBaseUrl: creds.baseUrl,
    htCliRefreshToken: creds.htCliRefreshToken,
    serviceIdentifier: creds.serviceIdentifer,
    requestTypesToTest: [requestTypes.GRAPHQL], // What kind of requests to include in the test
    // httpCandidateUrl: creds.httpBaseUrl, // HTTP URL of App under test (Optional)
    graphqlCandidateUrl: creds.graphqlAppUrl, // GraphQL URL of App under test (Optional)
    appStartCommand: 'node', // Command to start the app (Required)
    appStartCommandArgs: ['index.js'], // App start command arguments (Required)
    appWorkingDirectory: path.resolve(__dirname, creds.graphqlPackagePath), // Working directory for the app (default: current working dir) (Optional)
    appStartTimeoutSec: 10, // Timeout for the start command (default: 10) (Optional)
    showAppLogs: true, // Whether to show app logs (default: false) (Optional)
    shouldReportHeaderDiffs: false, // Whether to report differences in headers (default: false) (Optional)
    testBatchSize: 50, // Number of concurrent test requests (default: 50) (Optional)
    // testRequestsLimit: 0, // Number requests to test (Optional)
    httpReqFiltersArr: [], // "<GET /users>", "<ANY REGEX:^/payments>" (Optional)
    htExtraHeaders: {  // Object containing additional headers for HyperTest server requests (Optional)
        authorization: creds.authHeader,
    },
    // initialTimestamp: '', // Initial timestamp in ISO format (Optional)
    // finalTimestamp: '', // Final timestamp in ISO format (Optional)
};
