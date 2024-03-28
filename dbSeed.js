const { Pool } = require('pg');

const pool = new Pool({
  user: 'ht',
  host: 'localhost',
  database: 'banking_app',
  password: 'pass',
  port: 4321,
});

const createTables = async () => {
  const client = await pool.connect();
  try {
    // Create customers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100),
        address VARCHAR(255),
        mobile VARCHAR(10) UNIQUE,
        manager_approval BOOLEAN DEFAULT false,
        compliance_approval BOOLEAN DEFAULT false
      );
    `);

    // Create accounts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id),
        current_balance INTEGER DEFAULT 0,
        minimum_balance INTEGER DEFAULT 0
      );
    `);

    // Create transactions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        account_id INTEGER REFERENCES accounts(id),
        amount INTEGER,
        transaction_type VARCHAR(10)
      );
    `);
  } finally {
    client.release();
  }
};

const main = async () => {
  try {
    await createTables();
    console.log('Database seeding completed successfully.');
  } catch (err) {
    console.error('Error during database seeding:', err);
  } finally {
    await pool.end();
  }
};

main();
