// src/utils/logger.js
// Structured logger with correlation ID and JSON format

import { randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4
};

class Logger {
  constructor(options = {}) {
    this.level = LOG_LEVELS[options.level?.toUpperCase()] ?? LOG_LEVELS.INFO;
    this.serviceName = options.serviceName || 'pbs-bot';
    this.version = options.version || '2.0';
    this.enableConsole = options.enableConsole !== false;
    this.enableFile = options.enableFile || false;
    this.logDir = options.logDir || './logs';
    this.format = options.format || 'json'; // 'json' or 'pretty'
    
    // Create logs directory if file logging is enabled
    if (this.enableFile && !fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Generate correlation ID
   */
  static generateCorrelationId() {
    return randomBytes(8).toString('hex');
  }

  /**
   * Format log entry
   */
  _formatLog(level, message, context = {}) {
    const timestamp = new Date().toISOString();
    const correlationId = context.correlationId || Logger.generateCorrelationId();
    
    const logEntry = {
      timestamp,
      level,
      service: this.serviceName,
      version: this.version,
      correlationId,
      message,
      ...context
    };

    // Remove correlationId from context to avoid duplication
    delete logEntry.correlationId;
    
    return logEntry;
  }

  /**
   * Pretty print for console
   */
  _prettyPrint(logEntry) {
    const emoji = {
      DEBUG: '🔍',
      INFO: 'ℹ️',
      WARN: '⚠️',
      ERROR: '❌',
      FATAL: '💀'
    };

    const { timestamp, level, message, correlationId, ...rest } = logEntry;
    
    // Simple one-line format without timestamp and extra metadata
    let output = `${emoji[level]} ${message}`;
    
    // Only show important extra data (error, userId, etc)
    const important = ['error', 'userId', 'orderId', 'stack'];
    const filtered = Object.keys(rest)
      .filter(k => important.includes(k))
      .reduce((obj, k) => ({ ...obj, [k]: rest[k] }), {});
    
    if (Object.keys(filtered).length > 0) {
      output += ` ${JSON.stringify(filtered)}`;
    }
    
    return output;
  }

  /**
   * Write to file
   */
  _writeToFile(logEntry) {
    if (!this.enableFile) return;

    const filename = `${logEntry.level.toLowerCase()}.log`;
    const filepath = path.join(this.logDir, filename);
    const line = JSON.stringify(logEntry) + '\n';

    try {
      fs.appendFileSync(filepath, line);
    } catch (error) {
      console.error('Failed to write log:', error);
    }
  }

  /**
   * Core log method
   */
  _log(level, message, context) {
    if (LOG_LEVELS[level] < this.level) return;

    const logEntry = this._formatLog(level, message, context);

    // Console output
    if (this.enableConsole) {
      if (this.format === 'json') {
        console.log(JSON.stringify(logEntry));
      } else {
        // Simple format: just emoji + message
        console.log(this._prettyPrint(logEntry));
      }
    }

    // File output (always JSON for parsing)
    this._writeToFile(logEntry);
  }

  debug(message, context) {
    this._log('DEBUG', message, context);
  }

  info(message, context) {
    this._log('INFO', message, context);
  }

  warn(message, context) {
    this._log('WARN', message, context);
  }

  error(message, context) {
    this._log('ERROR', message, context);
  }

  fatal(message, context) {
    this._log('FATAL', message, context);
  }

  /**
   * Create child logger with inherited context
   */
  child(context) {
    const childLogger = Object.create(this);
    childLogger.defaultContext = { ...this.defaultContext, ...context };
    
    // Override _log to include default context
    const originalLog = this._log.bind(this);
    childLogger._log = (level, message, ctx) => {
      originalLog(level, message, { ...childLogger.defaultContext, ...ctx });
    };
    
    return childLogger;
  }

  /**
   * Create correlation middleware for Express
   */
  static createExpressMiddleware() {
    return (req, res, next) => {
      req.correlationId = Logger.generateCorrelationId();
      res.setHeader('X-Correlation-ID', req.correlationId);
      next();
    };
  }

  /**
   * Create correlation middleware for Telegraf
   */
  static createTelegrafMiddleware() {
    return (ctx, next) => {
      ctx.correlationId = Logger.generateCorrelationId();
      return next();
    };
  }
}

// Create default logger instance
export const logger = new Logger({
  level: process.env.LOG_LEVEL || 'INFO',
  serviceName: 'pbs-bot',
  version: '2.0',
  enableConsole: true,
  enableFile: process.env.LOG_TO_FILE === 'true',
  logDir: './logs',
  format: 'simple' // Changed from 'pretty' to 'simple' for cleaner output
});

export default Logger;
