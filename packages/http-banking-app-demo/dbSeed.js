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

const seedData = async () => {
  const client = await pool.connect();
  try {
    // Check if customers already exist
    const customers = await client.query('SELECT * FROM customers');
    if (customers.rowCount === 0) {
      // Insert sample customer data
      await client.query(`
        INSERT INTO customers (name, address, mobile, manager_approval, compliance_approval)
        VALUES 
        ('John Doe', '123 Main St', '555-1234', true, false),
        ('Jane Smith', '456 Elm St', '555-5678', true, true);
      `);
    }

    // Check if accounts already exist
    const accounts = await client.query('SELECT * FROM accounts');
    if (accounts.rowCount === 0) {
      // Insert sample account data
      await client.query(`
        INSERT INTO accounts (customer_id, current_balance, minimum_balance)
        VALUES 
        (1, 10000, 1000),
        (2, 20000, 1000);
      `);
    }

    // Check if transactions already exist
    const transactions = await client.query('SELECT * FROM transactions');
    if (transactions.rowCount === 0) {
      // Insert sample transaction data
      await client.query(`
        INSERT INTO transactions (account_id, amount, transaction_type)
        VALUES 
        (1, 1000, 'credit'),
        (2, -500, 'debit');
      `);
    }
  } finally {
    client.release();
  }
};

const main = async () => {
  try {
    await createTables();
    // await seedData();
    console.log('Database seeding completed successfully.');
  } catch (err) {
    console.error('Error during database seeding:', err);
  } finally {
    await pool.end();
  }
};

main();
