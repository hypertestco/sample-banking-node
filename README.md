# sample-banking-node
Demo app for previewing app for hypertest node sdk

## Prerequisites
1. Docker v25+. Install it using `curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh`
2. nodejs 18+. Install it using nvm. `nvm install 20`. get nvm from here https://github.com/nvm-sh/nvm

## Installation
- Clone the repo
- Create an account on hypertest. (https://hypertest.co)
- Log into hypertest dashboard using sso here (https://demo.hypertest.co).
- Select/create 3 services - one each for banking-service, approval-service and consumer. note the identifiers (it would be a uuid)
- populate service-identifiers.js file with the above identifiers
- Run `npm install`

## Initialization
- Start the app. run `npm run start`. This will spawn all three services in separate processes.
- Simulate traffic by running `npm run simulate-traffic`. You can also send http traffic manually using curl/postman etc

## Test execution
- Run `npm run test-cov:banking`
- Run `npm run test-cov:approval`
- Run `npm run test-cov:consumer`

- Test results would be available on cli and dashboard

## Coverage reports
- Coverage report would be present in coverage directory
