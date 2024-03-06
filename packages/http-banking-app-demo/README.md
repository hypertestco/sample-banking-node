# sample-banking-node
Demo app for previewing app for hypertest node sdk

## Prerequisites
1. Docker v25+. Install it using `curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh`
2. nodejs 18+. Install it using nvm. `nvm install 20`. get nvm from here https://github.com/nvm-sh/nvm

## Installation
- Clone the repo
- Obtain credentials from hypertest team (email, password, npm_token, service_identifier, things to set in creds.js)
- Log into hypertest dashboard using the email and password provided.
- Select/create a new service. note its identifier (it would be a uuid)
- Select/create a cli token from the UI, (click on profile icon on the top-left on the screen)
- Create .npmrc from .npmrc.example and update npm_token
- Create .htConf.js from .htConf.js.example
- Update values in `cred.js`
- Run `npm install`

## Initialization
- Start the app. run `npm run start`
- Simulate traffic by running `npm run simulate-traffic`. You can also send http traffic manually using curl/postman etc

## Test execution
- Run `npm run run-test`
- Test results would be available on cli and dashboard

## Coverage reports
- Run `npm run run-test-cov`
- Coverage report would be present in coverage directory
