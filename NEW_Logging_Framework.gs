// NEW_Logging_Framework.gs

/**
 * Logging Framework for Google Sheets
 * This framework provides a comprehensive logging system with different log levels,
 * functionality for logging sheets, and summary functions.
 **/

const LogLevel = {
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR'
};

class Logger {
    constructor(sheetName) {
        this.sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
        if (!this.sheet) {
            throw new Error('Sheet not found: ' + sheetName);
        }
    }

    log(level, message) {
        const timestamp = new Date().toISOString();
        this.sheet.appendRow([timestamp, level, message]);
    }

    debug(message) {
        this.log(LogLevel.DEBUG, message);
    }

    info(message) {
        this.log(LogLevel.INFO, message);
    }

    warn(message) {
        this.log(LogLevel.WARN, message);
    }

    error(message) {
        this.log(LogLevel.ERROR, message);
    }

    summary() {
        const data = this.sheet.getDataRange().getValues();
        const summary = {};
        data.forEach(row => {
            const level = row[1];  // Log level in the second column
            if (summary[level]) {
                summary[level]++;
            } else {
                summary[level] = 1;
            }
        });
        return summary;
    }
}

// Example usage:
// const logger = new Logger('LogSheet');
// logger.info('This is an info message.');
// const logSummary = logger.summary();
// Logger will log messages in the 'LogSheet'.