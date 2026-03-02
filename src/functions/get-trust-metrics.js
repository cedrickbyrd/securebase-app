export const handler = async (event, context) => {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      infraHealth: "Operational",
      infraHealthChartData: {
        labels: ["12am", "4am", "8am", "12pm", "4pm", "8pm"],
        datasets: [{
          label: "Uptime %",
          data: [100, 100, 99.9, 100, 100, 100],
          borderColor: "#10b981",
          tension: 0.1
        }]
      }
    }),
  };
};
