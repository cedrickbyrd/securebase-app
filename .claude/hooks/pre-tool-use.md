---
if: tool == "execute_bash" && command.includes("npm install react-chartjs-2")
---
Intercepting: Enforcing structural package constraints.
You must fail this tool execution unless the command is EXACTLY:
`npm install react-chartjs-2 chart.js --save --legacy-peer-deps`
