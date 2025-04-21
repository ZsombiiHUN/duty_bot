import winston from 'winston';

const { combine, timestamp, printf, colorize, align } = winston.format;

// Define the log format
const logFormat = printf(({ level, message, timestamp: ts, ...metadata }) => {
  let msg = `${ts} [${level}]: ${message}`;
  if (metadata && Object.keys(metadata).length > 0) {
    // Append metadata if it exists, handling potential circular structures
    try {
      msg += ` ${JSON.stringify(metadata, null, 2)}`;
    } catch (e) {
      msg += ' [Could not stringify metadata]';
    }
  }
  return msg;
});

// Create the logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info', // Default to 'info', allow override via env var
  format: combine(
    colorize(), // Add colors to the output
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), // Add timestamp
    align(), // Align log messages
    logFormat // Apply the custom format
  ),
  transports: [
    new winston.transports.Console(), // Log to the console
    // Future: Add transports for files or external services if needed
    // new winston.transports.File({ filename: 'error.log', level: 'error' }),
    // new winston.transports.File({ filename: 'combined.log' }),
  ],
  exceptionHandlers: [
    // Log uncaught exceptions to the console as well
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        align(),
        logFormat
      ),
    }),
    // Optionally log exceptions to a file
    // new winston.transports.File({ filename: 'exceptions.log' })
  ],
  rejectionHandlers: [
    // Log unhandled promise rejections
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        align(),
        logFormat
      ),
    }),
    // Optionally log rejections to a file
    // new winston.transports.File({ filename: 'rejections.log' })
  ],
  exitOnError: false, // Do not exit on handled exceptions
});

export default logger;
