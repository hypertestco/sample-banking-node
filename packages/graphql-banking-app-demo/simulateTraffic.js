const { gql, GraphQLClient } = require('graphql-request');
const creds = require('../../creds.js');

const graphqlRequest = new GraphQLClient(creds.graphqlAppUrl);


const { faker } = require('@faker-js/faker');

const baseURL = 'http://localhost:12300';

const data = {
    onboardCustomer: () => ({
        name: faker.person.fullName(),
        address: faker.location.streetAddress(),
        mobile: faker.string.numeric('##########'),
    }),
    updateCustomerAddress: ({ customerId, newAddress = '' }) => ({
        address: newAddress || faker.location.streetAddress(),
        customerId,
    }),
    managerApproval: ({ customerId, newAddress = '' }) => ({
        customerId,
        approve: Math.random() > 0.7 ? true : false,
    }),
    complianceApproval: ({ customerId }) => ({
        customerId,
        approve: Math.random() > 0.7 ? true : false,
    }),
    createAccount: ({ customerId }) => ({
        customerId,
        initialDeposit: Math.random() > 0.7 ? faker.number.int({ min: 10001, max: 1000000 }) : faker.number.int({ min: 0, max: 9999 }),
        minimumBalance: faker.number.int({ min: 0, max: 100000 })
    }),
    transaction: ({ accountId }) => ({
        accountId,
        amount: Math.random() > 0.7 ? faker.number.int({ min: -10000, max: 10000 }) : -5000000000,
    }),
    statement: ({ accountId }) => ({
        accountId,
    }),
    dollarConversionTest: {}
};

// Define the axios requests
// const staticRequests = [
//     // negative cases blank data
//     graphqlRequest.request(`mutation Mutation($name: String!, $address: String!, $mobile: String!) {
//                                         onboardCustomer(name: $name, address: $address, mobile: $mobile) {
//                                             customer_id
//                                         }
//                                      }`, {}),
//     axios.post(`${baseURL}/onboard-customer`, {
//         name: 'J',
//     }),
//     axios.post(`${baseURL}/onboard-customer`, {
//         name: 'John Doe',
//         address: '123 Main St',
//         mobile: '1234567890'
//     }),
//     axios.post(`${baseURL}/onboard-customer`, {
//         name: 'John Doe',
//         address: '123 Main St',
//         mobile: '1234567890'
//     }),
//
//     axios.put(`${baseURL}/update-customerAddress`, {}),
//     axios.post(`${baseURL}/manager-approval`, {}),
//     axios.post(`${baseURL}/compliance-approval`, {}),
//     axios.post(`${baseURL}/create-account`, {}),
//     axios.post(`${baseURL}/transaction`, {}),
//     axios.get(`${baseURL}/statement`, { params: {} }),
//
//     axios.get(`${baseURL}/dollar-coversion-test`, { params: {} }),
//     axios.get(`${baseURL}/404`, { params: {} }),
// ];


async function sampleFlow() {
    try {
        const onboardData = data.onboardCustomer();
        const onboardCustomerQuery = gql`
        mutation Mutation($name: String!, $address: String!, $mobile: String!) {
            onboardCustomer(name: $name, address: $address, mobile: $mobile) {
                customerId
            }
        }`
        const { onboardCustomer } = await graphqlRequest.request(onboardCustomerQuery, onboardData);
        const newCustomerId = onboardCustomer.customerId;

        const updateCustomerAddressQuery = gql`
        mutation Mutation($customerId: ID!, $address: String!) {
            updateCustomerAddress(customerId: $customerId, address: $address){
                status,
                oldAddress,
                newAddress
            }
        }`
        await graphqlRequest.request(updateCustomerAddressQuery, data.updateCustomerAddress({ customerId: newCustomerId, newAddress: onboardData.address }));
        await graphqlRequest.request(updateCustomerAddressQuery, data.updateCustomerAddress({ customerId: newCustomerId }));

        const managerApprovalQuery = gql`
        mutation Mutation($approve: Boolean!, $customerId:ID!) {
          managerApproval(customerId: $customerId, approve: $approve) {
            status
          }
        }`
        const managerApprovalArgs = data.managerApproval({ customerId: newCustomerId });
        console.log('manager args',JSON.stringify(managerApprovalArgs))
        const managerApprovalQueryResult = await graphqlRequest.request(managerApprovalQuery, managerApprovalArgs);
        console.log({managerApprovalQueryResult});

        const complianceApprovalQuery = gql`
        mutation Mutation($approve: Boolean!, $customerId:ID!) {
          complianceApproval(customerId: $customerId, approve: $approve) {
            status
          }
        }`
        const complianceArgs = data.complianceApproval({ customerId: newCustomerId });
        console.log('compliance args',JSON.stringify(complianceArgs))
        const complianceApprovalQueryResult = await graphqlRequest.request(complianceApprovalQuery, complianceArgs);
        console.log({complianceApprovalQueryResult});

        const createAccountQuery = gql`
        mutation Mutation($customerId:ID!, $initialDeposit: Float!, $minimumBalance: Float!) {
          createAccount(customerId: $customerId, initialDeposit: $initialDeposit, minimumBalance: $minimumBalance) {
            accountId
            status
          }
        }`
        const { createAccount } = await graphqlRequest.request(createAccountQuery, data.createAccount({ customerId: newCustomerId }));
        Math.random() > 0.7 && await graphqlRequest.request(createAccountQuery, data.createAccount({ customerId: newCustomerId }));
        const newAccountId = createAccount.accountId;

        const transactionCount = faker.number.int({ min: 3, max: 3 });
        const transactionQuery = gql`
        mutation Mutation($accountId: ID!, $amount: Float!) {
            transaction(accountId: $accountId, amount: $amount) {
                status
                oldBalance
                newBalance
            }
        }`
        for(let i=0; i<transactionCount; i++) {
            try {
                const transactionResult = await graphqlRequest.request(transactionQuery, data.transaction({ accountId: newAccountId }));
                console.log({transactionResult, i});
            } catch (error) {
                // do nothing
            }
        }

        const statementQuery = gql`
        query Query($accountId: ID!) {
          statement(accountId: $accountId){
            currentBalance,
            transactionCount,
          }
        },`
        const statementResult = await graphqlRequest.request(statementQuery, { accountId: newAccountId });
        console.log({statementResult});

        const dollarConversionTestQuery = gql`
        query Query($amount: Float!) {
          dollarCoversionTest(amount:$amount) {
            amount,
            coversionRate,
            convertedAmount,
            externalResponse,
          }
        }`
        const dollarConversionTest = await graphqlRequest.request(dollarConversionTestQuery, { amount: faker.number.int({ min: -50, max: 100 }) });
        console.log({dollarConversionTest});
    } catch (error) {
        console.error('somme error case occured, dont worry about it. It is all part of the simulation');
    }
}

const iterations = 100;

async function start() {
    console.log(`traffic simulation started. Will exit after ${iterations} iterations`);

    for(let i=0; i<iterations; i++) {
        await sampleFlow();
        // await Promise.allSettled(staticRequests);
    }
}

start();
