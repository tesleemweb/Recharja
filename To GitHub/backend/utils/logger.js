const Log = require('../models/Log');
const { isProduction } = require('../config/env');

const logToConsole = (level, message, context) => {
  const tag = level.toUpperCase().padEnd(5);
  const formatted = `[${new Date().toISOString()}] ${tag}: ${message}`;
  if (level === 'error') console.error(formatted, context || '');
  else if (level === 'warn') console.warn(formatted, context || '');
  else console.log(formatted, context || '');
};

const saveToDB = async (level, message, context) => {
  try {
    await Log.create({ level, message, context });
  } catch (err) {
    console.error('❌ Failed to save log to DB:', err.message);
  }
};

const logger = {
  info: (message, context = {}) => {
    if (!isProduction) logToConsole('info', message, context);
    else saveToDB('info', message, context);
  },
  warn: (message, context = {}) => {
    if (!isProduction) logToConsole('warn', message, context);
    else saveToDB('warn', message, context);
  },
  error: (message, context = {}) => {
    if (!isProduction) logToConsole('error', message, context);
    else saveToDB('error', message, context);
  },
  debug: (message, context = {}) => {
    if (!isProduction) logToConsole('debug', message, context);
    else saveToDB('debug', message, context);
  }
};

module.exports = logger;
