import winston from 'winston';
import path from 'path';

// Define custom log levels
const customLevels = {
    levels: {
        error: 0,
        warn: 1,
        info: 2,
        debug: 3,
        trace: 4,
    },
    colors: {
        error: 'red',
        warn: 'yellow',
        info: 'green',
        debug: 'blue',
        trace: 'gray',
    },
};

// Add colors to winston
winston.addColors(customLevels.colors);

// Create the logger instance
export const logger = winston.createLogger({
    levels: customLevels.levels,
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss',
        }),
        winston.format.errors({ stack: true }),
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
            let log = `${timestamp} [${level}]: ${message}`;
            
            // Add metadata if present
            if (Object.keys(meta).length > 0) {
                log += ` ${JSON.stringify(meta, null, 2)}`;
            }
            
            // Add stack trace for errors
            if (stack) {
                log += `\n${stack}`;
            }
            
            return log;
        })
    ),
    defaultMeta: {
        service: 'WinServerManager',
        pid: process.pid,
    },
    transports: [
        // Console transport
        new winston.transports.Console({
            handleExceptions: true,
            handleRejections: true,
        }),
        
        // File transports
        new winston.transports.File({
            filename: path.join(process.cwd(), 'logs', 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        new winston.transports.File({
            filename: path.join(process.cwd(), 'logs', 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
    ],
    exitOnError: false,
});

// Create logs directory if it doesn't exist
import fs from 'fs';
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}