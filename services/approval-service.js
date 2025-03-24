/* hypertest snippet starts */
process.env.HT_MODE = process.env.HT_MODE || 'RECORD';
const htSdk = require('@hypertestco/node-sdk');
htSdk.initialize({
  apiKey: 'DEMO-API-KEY',
  serviceId: require('../service-identifiers').approvalService,
  serviceName: 'demo-banking-approval',
  exporterUrl: require('../htServerUrl').logger,
});
/* hypertest snippet ends */

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


// approve customer
fastify.post('/approval/approve/:customerId', async (request, reply) => {
  try {
    const { customerId } = request.params;
    const customerFetch = await pool.query('select * from customers WHERE id = $1 limit 1', [customerId]);
    if (customerFetch.rowCount === 0) {
      reply.status(404).send({
        status: 'failed',
        message: `No customer found for id: ${customerId}`,
      })
      return;
    }

    if (customerFetch.rows[0].address.length < 5) {
      reply.status(422).send({
        status: 'failed',
        message: `invalid customer address for id: ${customerId}`,
      })
      return;
    }

    await pool.query('UPDATE customers SET manager_approval = $2 WHERE id = $1', [customerId, true]);
    return { status: 'approved' };
  } catch (error) {
    reply.status(400).send({ error: error.message });
  }
});

// get customer approval status
fastify.get('/approval/getstatus/:customerId', async (request, reply) => {
  try {
    const { customerId } = request.params;
    const customerFetch = await pool.query('select * from customers WHERE id = $1', [customerId]);
    if (customerFetch.rowCount === 0) {
      reply.status(404).send({
        status: 'failed',
        message: `No customer found for id: ${customerId}`,
      })
      return;
    }
    if(customerFetch.rows[0].manager_approval === true) {
      return { status: 'approved' };
    }
    return { status: 'not approved' };
  } catch (error) {
    reply.status(400).send({ error: error.message });
  }
});


// Start server
const start = async () => {
  try {
    await fastify.listen({ port: 12301, host: 'localhost' });
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


