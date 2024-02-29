const typeDefs = `#graphql
    type Customer {
        id: ID!
        name: String!
        address: String!
        email: String!
        mobile: String!
        manager_approval: Boolean!
        compliance_approval: Boolean!
    }

    type Account {
        id: ID!
        customer_id: ID!
        current_balance: Float!
        minimum_balance: Float!
    }

    type Transaction {
        id: ID!
        account_id: ID!
        amount: Float!
        transaction_type: String!
    }

    type OnboardCustomerResponse {
        customerId: ID!
        error: String
    }

    type updateCustomerAddressResponse {
        status: String!
        message: String
        oldAddress: String
        newAddress: String
    }

    type ManagerApprovalResponse {
        status: String!
        message: String
        error: String
    }

    type ComplianceApprovalResponse {
        status: String!
        message: String
        error: String
    }

    type CreateAccountResponse {
        accountId: ID
        error: String
        status: String
    }

    type transactionResponse {
        status: String
        oldBalance: Float
        newBalance: Float
        error: String
    }

    type StatementResponse {
        currentBalance: Float
        transactionCount: Int
        transactions: [Transaction]
    }

    type dollarCoversionTestResponse {
        amount: Float,
        coversionRate: Float,
        convertedAmount: Float,
        externalResponse: String,
    }

    type Mutation {
        onboardCustomer(name: String!, address: String!, mobile: String!): OnboardCustomerResponse!
        updateCustomerAddress(customerId: ID!, address: String!): updateCustomerAddressResponse!
        managerApproval(customerId: ID!, approve: Boolean): ManagerApprovalResponse!
        complianceApproval(customerId: ID!, approve: Boolean): ComplianceApprovalResponse!
        createAccount(customerId: ID!, initialDeposit: Float!, minimumBalance: Float!): CreateAccountResponse!
        transaction(accountId: ID!, amount: Float!): transactionResponse!
    }

    type Query {
        statement(accountId: ID!): StatementResponse!
        dollarCoversionTest(amount: Float!): dollarCoversionTestResponse!
    }
`;

module.exports = typeDefs;
