const { GraphQLError } = require('graphql');
const htSdk = require('@hypertestco/node-sdk');
const axios = require('axios');
const pg = require('pg');

const { Pool } = pg;
const Date = htSdk.HtDate;
// PostgreSQL connection
const pool = new Pool({
  user: 'ht',
  host: 'localhost',
  database: 'banking_app',
  password: 'pass',
  port: 4321,
});

function getCurrentConversionRate() {
    return Date.now() % 10;
}
const resolvers = {
    Query: {
        dollarCoversionTest: async (parent, args, context, info) => {
            // throw new Error('Invalid amount');


                let amount = Number(args.amount);
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

                return returnObj;
        },
        statement: async (parent, args, context, info) => {
            try {
                await axios.get('https://hypertest-demo-1234.requestcatcher.com/12345');
                const { accountId } = args;
                const balance = await pool.query('select current_balance from accounts where id = $1', [accountId]);
                const transaction = await pool.query('select * from transactions where account_id = $1', [accountId]);
                if (transaction.rowCount === 0) {
                  return { message: 'No tranasctions found' };
                }
                let transactionList = transaction.rows;
                // bug - 4
                // transactionList = transaction.rows.map(x => x.transaction_type === null).filter((x, index) => index < 1);

                const returnObj = {
                  currentBalance: balance.rows[0].current_balance,
                  transactionCount: transactionList.length,
                  transactions: transactionList,
                }

                return returnObj;
              }

              catch (error) {
                console.log(error);
                return { error: error.message };
              }
        }
    },
    Mutation: {
      onboardCustomer: async (parent, args, context, info) => {
        const { name, address, mobile } = args;
        if (name.length < 3 || address.length < 5 || mobile.length < 10) {
          throw new GraphQlError('please fill required field correctly')
        }
        const mobileCheck = await pool.query('SELECT * FROM customers WHERE mobile = $1', [mobile]);
        if (mobileCheck.rowCount > 0) {
          throw new Error('Mobile number already exists');
        }
        const res = await pool.query('INSERT INTO customers (name, address, mobile) VALUES ($1, $2, $3) RETURNING *', [name, address, mobile]);
        return { customerId: res.rows[0].id };
      },
      updateCustomerAddress: async (parent, args, context, info) => {
        const { address, customerId } = args;
        const oldAddressFetch = await pool.query('select address from customers WHERE id = $1', [customerId]);
        if (oldAddressFetch.rowCount === 0) {
          throw new Error(`No customer found for id: ${customerId}`);
        }
        const oldAddress = oldAddressFetch.rows[0].address
        if (oldAddress === address) {
          return {
            status: 'failed',
            message: `Previous and new address is same: ${address}`,
          };
        }
        await pool.query('UPDATE customers SET address = $1 WHERE id = $2', [address, customerId]);
        return {
          status: 'Address Updated Successfully',
          oldAddress,
          newAddress: address
        };
      },
      createAccount: async (parent, args, context, info) => {
        const { customerId, initialDeposit, minimumBalance } = args;
        const checkCustomerAccount = await pool.query('SELECT * FROM accounts WHERE customer_id = $1', [customerId])
        if (checkCustomerAccount.rowCount > 0) {
          return { error: "Account already exists", accountId: checkCustomerAccount.rows[0].id };
        }
        const customerQuery = await pool.query('SELECT * FROM customers WHERE id = $1', [customerId]);
        if (customerQuery.rowCount === 0) {
          throw new Error('Customer not found');
        }
        const customer = customerQuery.rows[0];
        if (!customer.manager_approval) {
          throw new Error('manager approval required');
        }
        if ((initialDeposit < 10000 && !customer.compliance_approval)) {
          throw new Error('compliance approval required');
        }
        if (initialDeposit < minimumBalance) {
          throw new Error('Initial deposit cannot be less than the minimum balance');
        }
        const res = await pool.query('INSERT INTO accounts (customer_id, current_balance, minimum_balance) VALUES ($1, $2, $3) RETURNING *', [customerId, initialDeposit, minimumBalance]);
        return { status: "success", accountId: res.rows[0].id };
      },
      managerApproval: async (parent, args, context, info) => {
        const { customerId, approve } = args;
        const customerFetch = await pool.query('select id from customers WHERE id = $1', [customerId]);
        if (customerFetch.rowCount === 0) {
          throw new Error(`No ccustomerId, approveustomer found for id: ${customerId}`);
        }
        await pool.query('UPDATE customers SET manager_approval = $2 WHERE id = $1', [customerId, approve]);
        if (!approve) {
          return { status: 'Manager approval cancelled' };
        }
        return { status: 'Manager approved' };
      },
      complianceApproval: async (parent, args, context, info) => {
        const { customerId, approve } = args;
        const customerFetch = await pool.query('select id from customers WHERE id = $1', [customerId]);
        if (customerFetch.rowCount === 0) {
          throw new Error(`No customer found for id: ${customerId}`);
        }
        await pool.query('UPDATE customers SET compliance_approval = $2 WHERE id = $1', [customerId, approve]);
        if (!approve) {
          return { status: 'Compliance approval cancelled' };
        }
        return { status: 'Compliance approved' };
      },
      transaction: async (parent, args, context, info) => {
        let { accountId, amount } = args;
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
      }
    }
}

module.exports = resolvers;
