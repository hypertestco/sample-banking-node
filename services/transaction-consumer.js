/* hypertest snippet starts */
process.env.HT_MODE = process.env.HT_MODE || 'RECORD';
const htSdk = require('@hypertestco/node-sdk');
htSdk.initialize({
  apiKey: 'DEMO-API-KEY',
  serviceId: require('../service-identifiers').transactionConsumer,
  serviceName: 'demo-banking-consumer',
  exporterUrl: require('../htServerUrl').logger,
});
/* hypertest snippet ends */

const { Pool } = require('pg');

// PostgreSQL connection
const pool = new Pool({
  user: 'ht',
  host: 'localhost',
  database: 'banking_app',
  password: 'pass',
  port: 4321,
});



const amqp = require('amqplib');

// RabbitMQ connection settings
const RABBITMQ_URL = 'amqp://localhost';
const QUEUE_NAME = 'transactionQueue';

async function startConsumer() {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });
    channel.prefetch(1);
    console.log(" [*] Waiting for messages in %s. To exit press CTRL+C", QUEUE_NAME);

    channel.consume(QUEUE_NAME, async (msg) => {
      if (msg !== null) {
        const message = JSON.parse(msg.content.toString());
        let { accountId, amount, transactionType } = message;

        // bug 1 - transaction type flipped
        // transactionType = transactionType === 'credit' ? 'debit': 'credit';

        const updateAmt = transactionType === 'credit' ? amount : -amount;

        try {
          await pool.query('UPDATE accounts SET current_balance = current_balance + $1 WHERE id = $2', [updateAmt, accountId]);
          await pool.query('INSERT INTO transactions (account_id, amount, transaction_type) VALUES ($1, $2, $3)', [accountId, amount, transactionType]);
          console.log(" [x] Processed transaction");
        } catch (error) {
          console.error('Error processing transaction:');
        }

        channel.ack(msg);
      }
    });
    /* hypertest snippet starts */
    htSdk.markAppAsReady();
    /* hypertest snippet ends */
  } catch (error) {
    console.error('Error starting consumer:', error);
  }
}

startConsumer();
