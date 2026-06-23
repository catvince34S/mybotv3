"use strict";

const MAX_LOGS = 500;
const logs = [];

function addLog(message) {
  const now = new Date();
  const ts = now.toISOString().replace("T", " ").substring(0, 19);
  const entry = `[${ts}] ${message}`;
  console.log(entry);
  logs.push(entry);
  if (logs.length > MAX_LOGS) logs.shift();
}

function getLogs() {
  return [...logs];
}

module.exports = { addLog, getLogs };
