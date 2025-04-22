/* hypertest snippet starts */
process.env.HT_MODE = process.env.HT_MODE || 'RECORD';
const htSdk = require('@hypertestco/node-sdk');
htSdk.initialize({
  apiKey: 'DEMO-API-KEY',
  serviceId: require('../service-identifiers').bankingService,
  serviceName: 'demo-banking-service-node',
  exporterUrl: require('../htServerUrl').logger,
});
/* hypertest snippet ends */


const approvalServiceBaseUrl = 'http://localhost:12301';

const amqp = require('amqplib');
const axios = require('axios');

// RabbitMQ connection settings
const RABBITMQ_URL = 'amqp://localhost:5672';
const QUEUE_NAME = 'transactionQueue';


const approvalServiceClient = axios.default.create({ baseURL: approvalServiceBaseUrl });
const fastify = require('fastify')({ logger: false });
const { Pool } = require('pg');

// PostgreSQL connection
const pool = new Pool({
  user: 'ht',
  host: 'localhost',
  database: 'banking_app',
  password: 'pass',
  port: 4321,
});

// amqp channel
let channel;

// Onboard new customer
fastify.post('/banking/onboard-customer', async (request, reply) => {
  const { name, address, mobile } = request.body;
  if (name.length < 3 || address.length < 5 || mobile.length < 10) {
    throw new Error('please fill required field correctly')
  }
  const mobileCheck = await pool.query('SELECT * FROM customers WHERE mobile = $1', [mobile]);
  if (mobileCheck.rowCount > 0) {
    throw new Error('Mobile number already exists');
  }
  const res = await pool.query('INSERT INTO customers (name, address, mobile) VALUES ($1, $2, $3) RETURNING *', [name, address, mobile]);
  return { customerId: res.rows[0].id };
});

// Update customer address
fastify.put('/banking/update-customer-address', async (request, reply) => {
  const { address, customerId } = request.body;
  const oldAddressFetch = await pool.query('select address from customers WHERE id = $1', [customerId]);
  if (oldAddressFetch.rowCount === 0) {
    reply.status(404).send({
      status: 'failed',
      message: `No customer found for id: ${customerId}`,
    })
    return;
  }
  const oldAddress = oldAddressFetch.rows[0].address
  if (oldAddress === address) {
    reply.status(400).send({
      status: 'failed',
      message: `Previous and new address is same: ${address}`,
    })
    return;
  }
  await pool.query('UPDATE customers SET address = $1 WHERE id = $2', [address, customerId]);
  return {
    status: 'Address Updated Successfully',
    oldAddress,
    newAddress: address
  };

});

// Manager approval
fastify.post('/banking/request-approval', async (request, reply) => {
  // correct implementation
  let { customerId } = request.body;

  // bug 2 - harcoding the customer id accidentally
  // customerId = 0;
  const { data } = await approvalServiceClient.post(`/approval/approve/${customerId}`, {});
  return data;
});

// Create new account
fastify.post('/banking/create-account', async (request, reply) => {
  const { customerId, initialDeposit, minimumBalance } = request.body;
  const checkCustomerAccount = await pool.query('SELECT * FROM accounts WHERE customer_id = $1', [customerId])
  if (checkCustomerAccount.rowCount > 0) {
    reply.status(400).send({ error: "Account already exists", accountId: checkCustomerAccount.rows });
    return;
  }

  // if (initialDeposit < minimumBalance) {
  //   reply.status(422).send({ error: 'Initial deposit cannot be less than the minimum balance' });
  //   return
  // }

  const { data } = await approvalServiceClient.get(`/approval/getstatus/${customerId}`);

  if (data.status !== 'approved') {
    reply.status(422).send({ error: 'approval required' });
    return
  }

  const res = await pool.query('INSERT INTO accounts (customer_id, current_balance, minimum_balance) VALUES ($1, $2, $3) RETURNING *', [customerId, initialDeposit, minimumBalance]);
  return { status: "success", accountId: res.rows[0].id };

});

// Transaction
fastify.post('/banking/transaction-async', async (request, reply) => {
  let { accountId, amount } = request.body;
  const accountQuery = await pool.query('SELECT * FROM accounts WHERE id = $1', [accountId]);
  if (accountQuery.rowCount === 0) {
    throw new Error('Account not found');
  }
  const account = accountQuery.rows[0];

  if(amount === 0) {
    throw new Error('Amount cannot be zero');
  }

  // CORRECT IMPLEMETATATION
  let transactionType = amount >= 0 ? 'credit' : 'debit';

  // bug 1 - transactionType reversed
  // transactionType = amount < 0 ? 'credit' : 'debit';

  const message = {
    accountId,
    amount: Math.abs(amount),
    transactionType,
  };

  await channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)));

  return { status: 'Transaction queued', message };

});

//Statement
fastify.get('/banking/statement', async (request, reply) => {
  const { accountId } = request.query;
  const balance = await pool.query('select current_balance from accounts where id = $1', [accountId]);
  const transaction = await pool.query('select * from transactions where account_id = $1', [accountId]);
  if (transaction.rowCount === 0) {
    reply.send({ message: 'No tranasctions found' })
    return
  }
  let transactionList = transaction.rows;
  // bug - 4
  // transactionList = transaction.rows.map(x => x.transaction_type === null).filter((x, index) => index < 1);

  const returnObj = {
    current_balance: balance.rows[0].current_balance,
    transactionCount: transactionList.length,
    transactions: transactionList,
  }

  reply.send(returnObj)

})

async function getCurrentConversionRate() {
  try {
    const { data } = await axios.default.get('https://www.randomnumberapi.com/api/v1.0/random?min=50&max=100&count=1');
    if (data && data[0] && typeof data[0] === 'number') {
      return data[0]
    }
  } catch (e) { }

  return 100;
}

fastify.get('/banking/currency-coversion', async (request, reply) => {
  let amount = Number(request.query.amount);
  if (isNaN(amount) || amount <= 0) {
    throw new Error('Invalid amount');
  }

  // making an outbount call for no reason
  const coversionRate = await getCurrentConversionRate();
  let convertedAmount = amount * coversionRate;

  // bug 5 - return wrong amount
  // convertedAmount = amount + coversionRate;

  const returnObj = {
    amount,
    coversionRate,
    convertedAmount,
  }

  reply.send(returnObj);

});

// Start server
const start = async () => {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });
    await fastify.listen({ port: 12300, host: 'localhost' });
    /* hypertest snippet starts */
    htSdk.markAppAsReady();
    /* hypertest snippet ends */
    fastify.log.info(`Server listening on ${fastify.server.address().port}`);
  } catch (err) /* istanbul ignore next */ {
    fastify.log.error(err);
    process.exit(1);
  }
};


(async () => {
  await start();
})();


