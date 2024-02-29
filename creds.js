const creds = {
    serviceIdentifer: '0c0c5136-7e46-408b-b84f-adbd3f18060a',  // set your service identifier
    htCliRefreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImlhdCI6MTcwNTQ3NzU2NSwiZXhwIjoxOTY0Njc3NTY1fQ.HdVZSOC0WUDHMTA2ua-RX3NhhTTEmwe6dnXJaB3xS4Y', // set your cli token
    authHeader: '', // set your auth header
    baseUrl: 'http://localhost:6010', // set your base url
    graphqlAppUrl: 'http://localhost:3000/graphql',
    loggerUrl: 'http://localhost:4317', // set your logger url
}

module.exports = creds;
