process.env.HT_MODE = process.env.HT_MODE || 'RECORD';

// @ts-expect-error ht
const htSdk = require('@hypertestco/node-sdk');
const Date = htSdk.HtDate; // if you want to mock system time

const creds = require('./creds');
const serviceId = creds.serviceIdentifer; //process.env.HT_SERVICE_ID; // set service id here

// istanbul ignore next
if (!serviceId) {
  throw new Error('Please set service id');
}

console.log({ serviceId });
htSdk.initialize({ apiKey: 'DEMO-API-KEY', serviceId });


const opentelemetry = require('@opentelemetry/sdk-node');
const {
  OTLPTraceExporter,
} = require('@opentelemetry/exporter-trace-otlp-grpc');

const HtTraceExporter = htSdk.getHtTraceExporter(OTLPTraceExporter);

const sdk = new opentelemetry.NodeSDK({
  serviceName: 'sample-banking-app-node',
  traceExporter: new HtTraceExporter({
    url: creds.loggerUrl,
  }),
});

sdk.start();
htSdk.setHtTracerProvider(sdk._tracerProvider);


const axios = require('axios');
const fastify = require('fastify')({ logger: true });
const { Pool } = require('pg');

// PostgreSQL connection
const pool = new Pool({
  user: 'ht',
  host: 'localhost',
  database: 'banking_app',
  password: 'pass',
  port: 4321,
});

// Onboard new customer
fastify.post('/onboard-customer', async (request, reply) => {
  try {
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
  } catch (error) {
    console.log('before')
    reply.status(400).send({ error: error.message });
    console.log('hellow');
  }
});

// Update customer address
fastify.put('/update-customerAddress', async (request, reply) => {
  try {
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
  } catch (error) {
    reply.status(400).send({ error: error.message });
  }
});

// Manager approval
fastify.post('/manager-approval', async (request, reply) => {
  try {
    const { customerId, approve } = request.body;
    const customerFetch = await pool.query('select id from customers WHERE id = $1', [customerId]);
    if (customerFetch.rowCount === 0) {
      reply.status(404).send({
        status: 'failed',
        message: `No customer found for id: ${customerId}`,
      })
      return;
    }
    await pool.query('UPDATE customers SET manager_approval = $2 WHERE id = $1', [customerId, approve]);
    if (!approve) {
      return { status: 'Manager approval cancelled' };
    }
    return { status: 'Manager approved' };
  } catch (error) {
    reply.status(400).send({ error: error.message });
  }
});

// Compliance approval
fastify.post('/compliance-approval', async (request, reply) => {
  try {
    const { customerId, approve } = request.body
    const customerFetch = await pool.query('select id from customers WHERE id = $1', [customerId]);
    if (customerFetch.rowCount === 0) {
      reply.status(404).send({
        status: 'failed',
        message: `No customer found for id: ${customerId}`,
      })
      return;
    }
    await pool.query('UPDATE customers SET compliance_approval = $2 WHERE id = $1', [customerId, approve]);
    if (!approve) {
      return { status: 'Compliance approval cancelled' };
    }
    return { status: 'Compliance approved' };
  } catch (error) {
    reply.status(400).send({ error: error.message });
  }
});

// Create new account
fastify.post('/create-account', async (request, reply) => {
  try {
    const { customerId, initialDeposit, minimumBalance } = request.body;
    checkCustomerAccount = await pool.query('SELECT * FROM accounts WHERE customer_id = $1', [customerId])
    if (checkCustomerAccount.rowCount > 0) {
      reply.status(400).send({ error: "Account already exists", accountId: checkCustomerAccount.rows });
      return;
    }
    const customerQuery = await pool.query('SELECT * FROM customers WHERE id = $1', [customerId]);
    if (customerQuery.rowCount === 0) {
      reply.status(404).send({ error: 'Customer not found' });
      return
    }
    const customer = customerQuery.rows[0];
    if (!customer.manager_approval) {
      reply.status(422).send({ error: 'manager approval required' });
      return
    }
    if ((initialDeposit < 10000 && !customer.compliance_approval)) {
      reply.status(422).send({ error: 'compliance approval required' });
      return
    }
    if (initialDeposit < minimumBalance) {
      reply.status(422).send({ error: 'Initial deposit cannot be less than the minimum balance' });
      return
    }
    const res = await pool.query('INSERT INTO accounts (customer_id, current_balance, minimum_balance) VALUES ($1, $2, $3) RETURNING *', [customerId, initialDeposit, minimumBalance]);
    return { status: "success", accountId: res.rows[0].id };
  } catch (error) {
    reply.status(400).send({ error: error.message });
  }
});

// Transaction
fastify.post('/transaction', async (request, reply) => {
  try {
    let { accountId, amount } = request.body;
    const accountQuery = await pool.query('SELECT * FROM accounts WHERE id = $1', [accountId]);
    if (accountQuery.rowCount === 0) {
      throw new Error('Account not found');
    }
    const account = accountQuery.rows[0];

    // CORRECT IMPLEMETATATION
    let newBalance = account.current_balance + amount;

    // bug 1 - tranction amount hardcoded to zero
    // newBalance = account.current_balance + 0;

    // bug 2 - flip amount to negative -> credit becomes debit and vice-versa
    // newBalance = account.current_balance - amount;

    if (newBalance < account.minimum_balance) {
      throw new Error('Transaction would result in balance falling below the minimum required');
    }
    await pool.query('UPDATE accounts SET current_balance = $1 WHERE id = $2', [newBalance, accountId]);
    const transactionType = amount >= 0 ? 'credit' : 'debit';
    await pool.query('INSERT INTO transactions (account_id, amount, transaction_type) VALUES ($1, $2, $3)', [accountId, amount, transactionType]);
    return { status: 'Transaction successful', oldBalance: account.current_balance, newBalance };
  } catch (error) {
    reply.status(400).send({ error: error.message });
  }
});

//Statement
fastify.get('/statement', async (request, reply) => {
  try {
    await axios.get('https://hypertest-demo-1234.requestcatcher.com/12345');
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
  }

  catch (error) {
    reply.status(400).send({ error: error.message });
    console.log(error);
  }
})

function getCurrentConversionRate() {
  return Date.now() % 10;
}

fastify.get('/dollar-coversion-test', async (request, reply) => {
  try {
    let amount = Number(request.query.amount);
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Invalid amount');
    }

    // making an outbount call for no reason
    const { data: externalResponse } = await axios.get('https://hypertest-demo-1234.requestcatcher.com/12345');
    const coversionRate = getCurrentConversionRate();
    let convertedAmount = amount * coversionRate;

    // bug 5 - return wrong amount
    // convertedAmount = amount + coversionRate;

    const returnObj = {
      amount,
      coversionRate,
      convertedAmount,
      externalResponse,
    }

    reply.send(returnObj);
  }

  catch (error) {
    reply.status(400).send({ error: error.message });
    // console.log(error);
  }
});

// Start server
const start = async () => {
  try {
    
    await fastify.listen({ port: 12300, host: 'localhost' });
    
    htSdk.markAppAsReady();
    
    fastify.log.info(`Server listening on ${fastify.server.address().port}`);
  } catch (err) /* istanbul ignore next */ {
    fastify.log.error(err);
    process.exit(1);
  }
};


(async () => {
  await start();
})();


