// Treasury Account Allocation Rules for TxImhotep LLC
const TREASURY_CONFIG = {
  bankName: "Incommons Bank",
  accounts: {
    mainOperating: {
      accountNumber: process.env.INCOMMONS_MAIN_ACCT_NO || "12345688",
      targetRatio: 0.7571, // 75.71% ($26.5k of $35k)
      description: "Primary Working Capital, AWS Cloud Ops & Engineering"
    },
    debtServiceReserve: {
      accountNumber: process.env.INCOMMONS_DSR_ACCT_NO || "12345689",
      targetRatio: 0.1429, // 14.29% ($5k of $35k)
      description: "Automated ACH Loan Reserve (Incommons Loan)"
    },
    taarReserve: {
      accountNumber: process.env.INCOMMONS_TAAR_ACCT_NO || "12345690",
      targetRatio: 0.1000, // 10.00% ($3.5k of $35k)
      description: "Tax & Accounting / Administrative Reserve"
    }
  }
};

module.exports = TREASURY_CONFIG;
