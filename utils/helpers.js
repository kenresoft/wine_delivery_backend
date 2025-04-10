/**
 * Checks if a value is a valid date string that can be parsed
 * @param {string} value - The date string to validate
 * @returns {boolean} True if valid date, false otherwise
 */
exports.isValidDate = (value) => {
    if (typeof value !== 'string') return false;
    const date = new Date(value);
    return !isNaN(date.getTime());
};

/**
 * Standardizes error response format
 */
exports.formatValidationErrors = (errors) => {
    return errors.array().map(err => ({
        field: err.path,
        message: err.msg,
        value: err.value
    }));
};