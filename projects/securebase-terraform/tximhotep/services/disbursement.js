/**
 * Calculates treasury disbursements upon loan funding receipt
 * @param {number} grossProceeds Total loan amount received (e.g., 35000)
 */
function calculateTreasuryDisbursement(grossProceeds = 35000) {
  const allocation = {
    mainOperating: grossProceeds * 0.7571,
    dsrReserve: grossProceeds * 0.1429,
    taarReserve: grossProceeds * 0.1000,
  };

  return {
    status: "SIMULATION_SUCCESS",
    bank: "Incommons Bank",
    primaryAccount: process.env.INCOMMONS_MAIN_ACCT_NO || "12345688",
    grossProceeds: grossProceeds.toFixed(2),
    allocations: {
      main_12345688: allocation.mainOperating.toFixed(2),
      dsr_12345689: allocation.dsrReserve.toFixed(2),
      taar_12345690: allocation.taarReserve.toFixed(2)
    }
  };
}

// Example Execution Output
console.log(calculateTreasuryDisbursement(35000));
