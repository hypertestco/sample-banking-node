const axios2 = require('axios');

const axios = axios2.create({  validateStatus: () => true});


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
    initialDeposit: Math.random() > 0.5 ? faker.number.int({ min: 10001, max: 1000000 }) : faker.number.int({ min: 0, max: 9999 }),
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
const staticRequests = [
  // negative cases blank data
  axios.post(`${baseURL}/onboard-customer`, {}),
  axios.post(`${baseURL}/onboard-customer`, {
    name: 'J',
  }),
  axios.post(`${baseURL}/onboard-customer`, {
    name: 'John Doe',
    address: '123 Main St',
    mobile: '1234567890'
  }),
  axios.post(`${baseURL}/onboard-customer`, {
    name: 'John Doe',
    address: '123 Main St',
    mobile: '1234567890'
  }),

  axios.put(`${baseURL}/update-customerAddress`, {}),
  axios.post(`${baseURL}/manager-approval`, {}),
  axios.post(`${baseURL}/compliance-approval`, {}),
  axios.post(`${baseURL}/create-account`, {}),
  axios.post(`${baseURL}/transaction`, {}),
  axios.get(`${baseURL}/statement`, { params: {} }),

  axios.get(`${baseURL}/dollar-coversion-test`, { params: {} }),
  axios.get(`${baseURL}/404`, { params: {} }),
];


async function sampleFlow() {
  try {
    const onboardData = data.onboardCustomer();
    const onboardRes = await axios.post(`${baseURL}/onboard-customer`, onboardData);
    const newCustomerId = onboardRes.data.customerId;

    await axios.put(`${baseURL}/update-customerAddress`, data.updateCustomerAddress({ customerId: newCustomerId, newAddress: onboardData.address }));
    await axios.put(`${baseURL}/update-customerAddress`, data.updateCustomerAddress({ customerId: newCustomerId }));

    await axios.post(`${baseURL}/manager-approval`, data.managerApproval({ customerId: newCustomerId }));
    await axios.post(`${baseURL}/compliance-approval`, data.complianceApproval({ customerId: newCustomerId }));

    const createAccountRes = await axios.post(`${baseURL}/create-account`, data.createAccount({ customerId: newCustomerId }));
    Math.random() > 0.7 && await axios.post(`${baseURL}/create-account`, data.createAccount({ customerId: newCustomerId }));
    const newAccountId = createAccountRes.data.accountId;

    const transactionCount = faker.number.int({ min: 0, max: 20 });
    for(let i=0; i<transactionCount; i++) {
      try {
        await axios.post(`${baseURL}/transaction`, data.transaction({ accountId: newAccountId }));
      } catch (error) {
        // do nothing
      }
    }

    await axios.get(`${baseURL}/statement`, { params: { accountId: newAccountId } });
    await axios.get(`${baseURL}/dollar-coversion-test`, { params: { amount: faker.number.int({ min: -50, max: 100 })} });
  } catch (error) {
    console.error('somme error case occured, dont worry about it. It is all part of the simulation');
  }
}

const iterations = 10;

async function start() {
  console.log(`traffic simulation started. Will exit after ${iterations} iterations`);

  for(let i=0; i<iterations; i++) {
    await sampleFlow();
    await Promise.allSettled(staticRequests);
  }
  console.log('traffic simulation complete');
}

start();

