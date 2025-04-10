const fs = require('fs');
const path = require('path');

// Optional: Setup log file
const logFilePath = path.join(__dirname, '../logs/app.log');

// Ensure logs directory exists
if (!fs.existsSync(path.dirname(logFilePath))) {
  fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
}

const getTimestamp = () => {
  return new Date().toISOString();
};

const logToFile = (level, message) => {
  const logEntry = `[${getTimestamp()}] [${level.toUpperCase()}] ${message}\n`;
  fs.appendFile(logFilePath, logEntry, err => {
    if (err) {
      console.error('[LOGGER] Failed to write to log file:', err.message);
    }
  });
};

const logger = {
  info: (msg) => {
    const formatted = `[${getTimestamp()}] [INFO] ${msg}`;
    console.log(`\x1b[36m%s\x1b[0m`, formatted); // Cyan
    logToFile('info', msg);
  },

  warn: (msg) => {
    const formatted = `[${getTimestamp()}] [WARN] ${msg}`;
    console.warn(`\x1b[33m%s\x1b[0m`, formatted); // Yellow
    logToFile('warn', msg);
  },

  error: (msg) => {
    const formatted = `[${getTimestamp()}] [ERROR] ${msg}`;
    console.error(`\x1b[31m%s\x1b[0m`, formatted); // Red
    logToFile('error', msg);
  }
};

module.exports = logger;
