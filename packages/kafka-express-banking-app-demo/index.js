process.env.HT_MODE = process.env.HT_MODE || 'RECORD';

const htSdk = require('@hypertestco/node-sdk');
const Date = htSdk.HtDate; // if you want to mock system time

/* -- DELETE before pre pushing to git -- */
// const localServiceId = 'e700b4bd-7395-4217-988e-8bc4cc3bcfb6';
// const remoteServiceId = '8e950615-2d5f-4e64-ac10-62d972e82c80'
const creds = require('./creds');
const serviceId = creds.serviceIdentifer; //process.env.HT_SERVICE_ID; // set service id here

/* istanbul ignore next */
if (!serviceId) {
  throw new Error('Please set service id');
}

htSdk.initialize({ apiKey: 'DEMO-API-KEY', serviceId });

const opentelemetry = require('@opentelemetry/sdk-node');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const {
  OTLPTraceExporter,
} = require('@opentelemetry/exporter-trace-otlp-grpc');

// Define your resource
const resource = new Resource({
  [SemanticResourceAttributes.SERVICE_NAME]: 'sample-banking-app-node',
  [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.1',
});

const sdk = new opentelemetry.NodeSDK({
  resource,
  traceExporter: new OTLPTraceExporter({
    // url: "http://localhost:4317",
    // url: 'http://localhost:3008',
    url: creds.loggerUrl,
  }),
  instrumentations: [],
});

sdk.start();

htSdk.autoInstrumentation();
htSdk.setHtTracerProvider(sdk._tracerProvider);


const express = require('express');
const { Kafka } = require('kafkajs');
const { Pool } = require('pg');
const axios = require('axios');


function getCurrentConversionRate() {
  return Date.now() % 10;
}

const app = express();
const port = 12301;

const kafka = new Kafka({
  clientId: 'banking-service',
  brokers: ['localhost:9092'],
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'customer-group' });
const consumer2 = kafka.consumer({ groupId: 'statement-group' });

const pool = new Pool({
  user: 'ht',
  host: 'localhost',
  database: 'banking_app',
  password: 'pass',
  port: 4321,
});

const connectKafka = async () => {
  await producer.connect();
  await consumer.connect();
  await consumer2.connect();
  await consumer.subscribe({ topic: 'customer-events' });
  await consumer.subscribe({ topic: 'transaction-events' });
  await consumer2.subscribe({ topic: 'statement-events' });
};

const publishToKafka = async (topic, message) => {
  try {
    await producer.send({
      topic,
      messages: [{ value: JSON.stringify(message) }],
    });
  } catch (error) {
    console.error('Error publishing to Kafka:', error);
  }
};
const consumeCustomerEventsFromKafka = async () => {
  await consumer2.run({
    eachMessage: async ({ topic, partition, message }) => {
      console.log(`Received message from topic ${topic}: ${message.value}`);
      // Handle received message
      // For example, update database based on the received event
      const eventData = JSON.parse(message.value.toString());
      const data = eventData.data;
      console.log('eventData ----------- ', eventData);
      switch (eventData.eventType) {
        case 'statement':
          const { accountId: requestStatementAccountId } = data;
          // bug - 6
          // change requestStatementAccountId to 123456 -  non-existent
          const balance = await pool.query('select current_balance from accounts where id = $1', [requestStatementAccountId]);
          const transaction = await pool.query('select * from transactions where account_id = $1', [requestStatementAccountId]);
          if (transaction.rowCount === 0) {
            console.error({ message: 'No transactions found' })
            return
          }
          let transactionList
          transactionList = transaction.rows;
          // bug - 4
          // transactionList = transaction.rows.map(x => x.transaction_type === null).filter((x, index) => index < 1);

          const returnObj = {
            current_balance: balance.rows[0].current_balance,
            transactionCount: transactionList.length,
            transactions: transactionList,
          }
          console.log(returnObj)
          break;
      }
    },
  })
}

const consumeFromKafka = async () => {
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      console.log(`Received message from topic ${topic}: ${message.value}`);
      // Handle received message
      // For example, update database based on the received event
      const eventData = JSON.parse(message.value.toString());
      const data = eventData.data;
      console.log('eventData ----------- ', eventData);
      switch (eventData.eventType) {
        case 'customer-onboarded':
          //TODO: Handle customer onboarded event if needed
          break;

        case 'customer-address-updated':
          const { customerId, address } = data;
          const oldAddressFetch = await pool.query('select address from customers WHERE id = $1', [customerId]);
          if (oldAddressFetch.rowCount === 0) {
            console.error(`No customer found for id: ${customerId}`);
            return; // Do not send error response, just log and return
          }
          const oldAddress = oldAddressFetch.rows[0].address;
          if (oldAddress === address) {
            console.error(`Previous and new address is same: ${address}`);
            return; // Do not send error response, just log and return
          }
          await pool.query('UPDATE customers SET address = $1 WHERE id = $2', [address, customerId]);
          console.log(`Updated address for customer: ${customerId} to ${address}`);
          break;

        case 'manager-approval-events':
          // Process manager approval event
          const { customerId: managerAprrovalCustomerId, approve: managerAprroval } = data;
          console.log("data------", data)
          await pool.query('UPDATE customers SET manager_approval = $2 WHERE id = $1', [managerAprrovalCustomerId, managerAprroval]);
          break;

        case 'compliance-approval-events':
          // Process compliance approval event
          const { customerId: complianceAprrovalCustomerId, approve: complianceAprroval } = data;
          await pool.query('UPDATE customers SET compliance_approval = $2 WHERE id = $1', [complianceAprrovalCustomerId, complianceAprroval]);
          break;

        case 'create-account':
          // Process create account event
          const { customerId: createAccountCustomerId, initialDeposit, minimumBalance } = data;
          try {
            const checkCustomerAccount = await pool.query('SELECT * FROM accounts WHERE customer_id = $1', [createAccountCustomerId]);
            if (checkCustomerAccount.rowCount > 0) {
              console.error('Account already exists for customer:', createAccountCustomerId);
              return;
            }
            const customerQuery = await pool.query('SELECT * FROM customers WHERE id = $1', [createAccountCustomerId]);
            if (customerQuery.rowCount === 0) {
              console.error('Customer not found:', createAccountCustomerId);
              return;
            }
            const customer = customerQuery.rows[0];
            if (!customer.manager_approval || (initialDeposit < 10000 && !customer.compliance_approval) || initialDeposit < minimumBalance) {
              console.error('Account creation criteria not met for customer:', createAccountCustomerId);
              return;
            }
            const dbres = await pool.query('INSERT INTO accounts (customer_id, current_balance, minimum_balance) VALUES ($1, $2, $3)', [createAccountCustomerId, initialDeposit, minimumBalance]);
            const trnsId = await pool.query('select id from accounts order by id desc limit 1',);
            console.log({
              'Account created successfully for customer:': createAccountCustomerId,
              accountId: trnsId.rows[0].id
            });
          } catch (error) {
            console.error('Error processing account creation:', error);
          }
          break;

        case 'transaction':
          const { accountId, amount } = data;
          try {
            const accountQuery = await pool.query('SELECT * FROM accounts WHERE id = $1', [accountId]);
            if (accountQuery.rowCount === 0) {
              console.error('Account not found:', accountId);
              return;
            }
            const account = accountQuery.rows[0];
            let newBalance = account.current_balance + amount;


            // bug 1 - tranction amount hardcoded to zero
            // newBalance = account.current_balance + 0;

            // bug 2 - flip amount to negative -> credit becomes debit and vice-versa
            // newBalance = account.current_balance - amount;


            if (newBalance < account.minimum_balance) {
              console.error('Transaction would result in balance falling below the minimum required:', accountId);
              return;
            }
            await pool.query('UPDATE accounts SET current_balance = $1 WHERE id = $2', [newBalance, accountId]);
            const transactionType = amount >= 0 ? 'credit' : 'debit';
            await pool.query('INSERT INTO transactions (account_id, amount, transaction_type) VALUES ($1, $2, $3)', [accountId, amount, transactionType]);
            console.log('Transaction processed successfully for account:', accountId);
          } catch (error) {
            console.error('Error processing transaction:', error);
          }
          break;

        case 'dollar-conversion-test':
          const { amount: conversionAmount } = data;
          if (conversionAmount === undefined || isNaN(Number(conversionAmount)) || Number(conversionAmount) <= 0) {
            console.error('Invalid or missing amount for dollar-conversion-test event');
            return;
          }
          // making an outbount call for no reason
          const { data: externalResponse } = await axios.get('https://hypertest-demo-1234.requestcatcher.com/12345');
          const conversionRate = getCurrentConversionRate();
          let convertedAmount = conversionAmount * conversionRate;

          // bug 5 - return wrong amount
          // convertedAmount = amount + coversionRate;

          const returnConversionObj = {
            conversionAmount,
            conversionRate,
            convertedAmount,
            externalResponse,
          }

          console.log(returnConversionObj);
          break;

        default:
          console.log('Unknown event type:', eventData.eventType);
      }
    },
  });
};

app.use(express.json());

app.post('/onboard-customer', async (req, res) => {
  try {
    const { name, address, mobile } = req.body;
    if (!name || name.length < 3 || !address || address.length < 5 || !mobile || mobile.length < 10) {
      throw new Error('Please fill required fields correctly');
    }

    const mobileCheck = await pool.query('SELECT * FROM customers WHERE mobile = $1', [mobile]);
    if (mobileCheck.rowCount > 0) {
      throw new Error('Mobile number already exists');
    }
    const dbres = await pool.query('INSERT INTO customers (name, address, mobile) VALUES ($1, $2, $3) RETURNING *', [name, address, mobile]);
    await publishToKafka('customer-events', { eventType: 'customer-onboarded', data: { name, address, mobile, customerId: dbres.rows[0].id } });
    res.json({ message: 'Customer onboarding initiated', customerId: dbres.rows[0].id });
    // return { customerId: dbres.rows[0].id };
  } catch (error) {
    console.error('Error onboarding customer:', error);
    res.status(400).json({ error: error.message });
  }
});

app.put('/update-customerAddress', async (req, res) => {
  try {
    const { address, customerId } = req.body;
    const oldAddressFetch = await pool.query('select address from customers WHERE id = $1', [customerId]);
    if (oldAddressFetch.rowCount === 0) {
      res.status(404).send({
        status: 'failed',
        message: `No customer found for id: ${customerId}`,
      });
      return;
    }
    const oldAddress = oldAddressFetch.rows[0].address;
    if (oldAddress === address) {
      res.status(400).send({
        status: 'failed',
        message: `Previous and new address is same: ${address}`,
      });
      return;
    }
    await pool.query('UPDATE customers SET address = $1 WHERE id = $2', [address, customerId]);

    await publishToKafka('customer-events', { eventType: 'customer-address-updated', data: { customerId, address } });

    res.json({
      status: 'Address Updated Successfully',
      oldAddress,
      newAddress: address,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/manager-approval', async (req, res) => {
  try {
    const { customerId, approve } = req.body;
    await publishToKafka('customer-events', { eventType: 'manager-approval-events', data: { customerId, approve } });
    res.json({ message: 'Manager approval process initiated' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/compliance-approval', async (req, res) => {
  try {
    const { customerId, approve } = req.body;
    await publishToKafka('customer-events', { eventType: 'compliance-approval-events', data: { customerId, approve } });
    res.json({ message: 'Compliance approval process initiated' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});


app.post('/create-account', async (req, res) => {
  try {
    const { customerId: createAccountCustomerId, initialDeposit, minimumBalance } = req.body;
    const checkCustomerAccount = await pool.query('SELECT * FROM accounts WHERE customer_id = $1', [createAccountCustomerId]);
    if (checkCustomerAccount.rowCount > 0) {
      res.status(400).json({ error: 'Account already exists for customer' });
      console.error('Account already exists for customer:', { createAccountCustomerId });
      return;
    }
    const customerQuery = await pool.query('SELECT * FROM customers WHERE id = $1', [createAccountCustomerId]);
    if (customerQuery.rowCount === 0) {
      res.status(400).json({ error: 'Customer not found' });
      console.error('Customer not found:', { createAccountCustomerId });
      return;
    }
    const customer = customerQuery.rows[0];
    if (!customer.manager_approval || (initialDeposit < 10000 && !customer.compliance_approval) || initialDeposit < minimumBalance) {
      console.error('Account creation criteria not met for customer:', { createAccountCustomerId });
      res.status(400).json({ error: 'Account creation criteria not met' });
      return;
    }
    await pool.query(
      'INSERT INTO accounts (customer_id, current_balance, minimum_balance) VALUES ($1, $2, $3)',
      [createAccountCustomerId, initialDeposit, minimumBalance]
    );
    const fetchAccountId = await pool.query('select id from accounts WHERE customer_id = $1', [createAccountCustomerId]);
    const trnsId = fetchAccountId.rows[0].id;

    console.log({
      'Account created successfully for customer:': { createAccountCustomerId },
      accountId: trnsId
    });
    res.json({ message: 'Account creation request received', accountId: trnsId });

  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/transaction', async (req, res) => {
  try {
    await publishToKafka('transaction-events', { eventType: 'transaction', data: req.body });
    res.json({ message: 'Transaction request received' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/statement', async (req, res) => {
  const { accountId } = req.query;
  try {
    const balance = await pool.query('select current_balance from accounts where id = $1', [accountId]);
    if (balance.rowCount === 0) {
      return res.status(404).json({ error: 'No account found' });
    }
    const transaction = await pool.query('select * from transactions where account_id = $1', [accountId]);
    const transactionList = transaction.rows;
    const returnObj = {
      current_balance: balance.rows[0].current_balance,
      transactionCount: transactionList.length,
      transactions: transactionList,
    };
    await publishToKafka('statement-events', { eventType: 'statement', data: { accountId } });
    res.json({ message: 'Statement', returnObj });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});


app.get('/dollar-conversion-test', async (req, res) => {
  const { amount } = req.query;
  const convertNum = Number(amount);
  if (isNaN(convertNum) || convertNum <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }
  try {
    await publishToKafka('customer-events', {
      eventType: 'dollar-conversion-test',
      data: { amount: convertNum }
    });
    res.json({ message: 'Dollar conversion test request received' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});


const startServer = async () => {
  try {
    await connectKafka();
    await consumeFromKafka();
    await consumeCustomerEventsFromKafka();
    app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
      htSdk.markAppAsReady();
    });
  } catch (error) {
    console.error('Error starting server:', error);
  }
};

Promise.all([]).then(() => startServer());