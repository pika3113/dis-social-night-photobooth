/**
 * Enhanced logging utility for the photobooth application
 * Provides structured logging with timestamps and severity levels
 */

const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const LOG_FILE = path.join(logsDir, `photobooth-${new Date().toISOString().split('T')[0]}.log`);

const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG',
  SUCCESS: 'SUCCESS'
};

const LOG_COLORS = {
  ERROR: '\x1b[31m',    // Red
  WARN: '\x1b[33m',     // Yellow
  INFO: '\x1b[36m',     // Cyan
  DEBUG: '\x1b[35m',    // Magenta
  SUCCESS: '\x1b[32m'   // Green
};

const RESET_COLOR = '\x1b[0m';

function formatLogMessage(level, message, data = null) {
  const timestamp = new Date().toISOString();
  let formatted = `[${timestamp}] [${level}] ${message}`;
  
  if (data) {
    if (typeof data === 'object') {
      formatted += ` ${JSON.stringify(data)}`;
    } else {
      formatted += ` ${data}`;
    }
  }
  
  return formatted;
}

function writeToFile(message) {
  try {
    fs.appendFileSync(LOG_FILE, message + '\n', 'utf8');
  } catch (err) {
    console.error('Failed to write to log file:', err.message);
  }
}

function logToConsole(level, message, data = null) {
  const formatted = formatLogMessage(level, message, data);
  const color = LOG_COLORS[level] || '';
  console.log(`${color}${formatted}${RESET_COLOR}`);
}

const logger = {
  error: (message, data) => {
    logToConsole(LOG_LEVELS.ERROR, message, data);
    writeToFile(formatLogMessage(LOG_LEVELS.ERROR, message, data));
  },
  
  warn: (message, data) => {
    logToConsole(LOG_LEVELS.WARN, message, data);
    writeToFile(formatLogMessage(LOG_LEVELS.WARN, message, data));
  },
  
  info: (message, data) => {
    logToConsole(LOG_LEVELS.INFO, message, data);
    writeToFile(formatLogMessage(LOG_LEVELS.INFO, message, data));
  },
  
  debug: (message, data) => {
    if (process.env.DEBUG) {
      logToConsole(LOG_LEVELS.DEBUG, message, data);
      writeToFile(formatLogMessage(LOG_LEVELS.DEBUG, message, data));
    }
  },
  
  success: (message, data) => {
    logToConsole(LOG_LEVELS.SUCCESS, message, data);
    writeToFile(formatLogMessage(LOG_LEVELS.SUCCESS, message, data));
  }
};

module.exports = logger;
