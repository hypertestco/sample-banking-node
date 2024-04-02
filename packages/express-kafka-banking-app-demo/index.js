
process.env.HT_MODE = process.env.HT_MODE || 'RECORD';

const htSdk = require('@hypertestco/node-sdk');
const Date = htSdk.HtDate; // if you want to mock system time

/* -- DELETE before pre pushing to git -- */
const localServiceId = 'e700b4bd-7395-4217-988e-8bc4cc3bcfb6';
const remoteServiceId = '8e950615-2d5f-4e64-ac10-62d972e82c80'
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

const app = express();
const port = 12301;

const kafka = new Kafka({
  clientId: 'banking-service',
  brokers: ['localhost:9092'],
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'customer-group' });

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
  await consumer.subscribe({ topic: 'customer-events' });
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

const consumeFromKafka = async () => {
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      console.log(`Received message from topic ${topic}: ${message.value.toString()}`);
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
          //TODO: Handle customer address updated event if needed
        break;

        case 'manager-approval-events':
          // Process manager approval event

          const { customerId : managerAprrovalCustomerId, approve: managerAprroval  } = data;
          console.log("data------" , data)
          await pool.query('UPDATE customers SET manager_approval = $2 WHERE id = $1', [managerAprrovalCustomerId, managerAprroval]);
        break;
      
        case 'compliance-approval-events':
          // Process compliance approval event
          const { customerId: complianceAprrovalCustomerId, approve: complianceAprroval } = data;
          await pool.query('UPDATE customers SET compliance_approval = $2 WHERE id = $1', [complianceAprrovalCustomerId, complianceAprroval]);
        break;  

        case 'create-account':
        // Process create account event
         const { customerId : createAccountCustomerId, initialDeposit, minimumBalance } = data;
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
          console.log({'Account created successfully for customer:': createAccountCustomerId,
          accountId: dbres.rows[0].id });
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

        case 'statement':
            const { accountId : requestStatementAccountId } = data;
            const balance = await pool.query('select current_balance from accounts where id = $1', [requestStatementAccountId]);
            const transaction = await pool.query('select * from transactions where account_id = $1', [requestStatementAccountId]);
            if (transaction.rowCount === 0) {
                res.status(400).json({ message: 'No tranasctions found' })
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
            console.log(returnObj)
        break;

        case 'dollar-conversion-test':
            const { amount: conversionAmount  } = data;
                if (isNaN(conversionAmount) || conversionAmount <= 0) {
                  throw new Error('Invalid amount');
                }
            
                // making an outbount call for no reason
                const { data: externalResponse } = await axios.get('https://hypertest-demo-1234.requestcatcher.com/12345');
                const coversionRate = getCurrentConversionRate();
                let convertedAmount = conversionAmount * coversionRate;
            
                // bug 5 - return wrong amount
                // convertedAmount = amount + coversionRate;
            
                const returnConversionObj = {
                  amount,
                  coversionRate,
                  convertedAmount,
                  externalResponse,
                }
            
                res.json(returnConversionObj);            
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
    res.json({ message: 'Customer onboarding initiated', customerId: dbres.rows[0].id  });
    // return { customerId: dbres.rows[0].id };
  } catch (error) {
    console.error('Error onboarding customer:', error);
    res.status(400).json({ error: error.message });
  }
});

app.put('/update-customer-address', async (req, res) => {
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
      await publishToKafka('customer-events', { eventType: 'manager-approval-events', data : { customerId, approve }});
      res.json({ message: 'Manager approval process initiated' });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
  
  app.post('/compliance-approval', async (req, res) => {
    try {
      const { customerId, approve } = req.body;
      await publishToKafka('customer-events', { eventType: 'compliance-approval-events', data : { customerId, approve }});
      res.json({ message: 'Compliance approval process initiated' });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
  
  app.post('/create-account', async (req, res) => {
    try {
      await publishToKafka('customer-events', { eventType: 'create-account', data: req.body });
      res.json({ message: 'Account creation request received' });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
  
  app.post('/transaction', async (req, res) => {        
    try {
      await publishToKafka('customer-events', { eventType: 'transaction', data: req.body });
      res.json({ message: 'Transaction request received'});
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/statement', async (req, res) => {
    const { accountId } = req.query;
    try{
      await publishToKafka('customer-events', { eventType: 'statement', data: { accountId } });
      res.json({ message: 'Statement request received' });
    }catch(error){
      res.status(400).json({ error: error.message });
    }
  });
  
  app.get('/dollar-conversion-test', async (req, res) => {
    const { amount } = req.query;
    try{
      await publishToKafka('customer-events', { eventType: 'dollar-conversion-test', data: { amount } });
      res.json({ message: 'Dollar conversion test request received' });
    }    catch(error){
      res.status(400).json({ error: error.message });
    }
  });


const startServer = async () => {
  try {
    await connectKafka();
    await consumeFromKafka();
    app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Error starting server:', error);
  }
};

Promise.all([]).then(() => startServer());
  