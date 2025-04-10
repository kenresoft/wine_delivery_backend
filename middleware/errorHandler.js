/**
 * Comprehensive error handling middleware with advanced response formatting,
 * environment-aware error details, and operational error distinction.
 */
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

/**
 * Development environment error formatter with detailed debugging information
 */
const sendDevError = (err, res) => {
    const response = {
        success: false,
        statusCode: err.statusCode || 500,
        message: err.message,
        stack: err.stack,
        errorCode: err.errorCode || 'SERVER_ERROR',
        timestamp: err.timestamp || new Date().toISOString()
    };

    // Include additional contextual data if available
    if (err.additionalData && Object.keys(err.additionalData).length > 0) {
        response.details = err.additionalData;
    }

    res.status(err.statusCode || 500).json(response);
};

/**
 * Production environment error formatter with sanitized client-safe information
 */
const sendProdError = (err, res) => {
    // For operational errors (expected application errors), send details
    if (err.isOperational) {
        const response = {
            success: false,
            statusCode: err.statusCode || 500,
            message: err.message,
            errorCode: err.errorCode || 'SERVER_ERROR'
        };

        // Include additional contextual data if available
        if (err.additionalData && Object.keys(err.additionalData).length > 0) {
            response.details = err.additionalData;
        }

        return res.status(err.statusCode || 500).json(response);
    }

    // For programming errors, send generic message to avoid leaking implementation details
    logger.error('PROGRAMMING ERROR:', err);

    res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Something went wrong',
        errorCode: 'INTERNAL_SERVER_ERROR'
    });
};

/**
 * Transform common Node/Express errors into operational AppErrors
 */
const normalizeError = (err) => {
    // Mongoose validation errors
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(val => val.message);
        return new AppError(`Validation failed: ${errors.join(', ')}`, 400, { fields: err.errors });
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        return new AppError(`Duplicate value for ${field}`, 409, { field, value: err.keyValue[field] });
    }

    // Mongoose CastError (invalid ID)
    if (err.name === 'CastError') {
        return new AppError(`Invalid ${err.path}: ${err.value}`, 400);
    }

    // JSON parsing error
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return new AppError('Invalid JSON payload', 400);
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return new AppError('Invalid authentication token', 401);
    }

    if (err.name === 'TokenExpiredError') {
        return new AppError('Authentication token expired', 401);
    }

    return err;
};

/**
 * Global error handling middleware
 * Intercepts all errors and formats consistent JSON responses
 */
module.exports = (err, req, res, next) => {
    // Prevent hanging response
    if (res.headersSent) {
        return next(err);
    }

    // Log all errors for debugging and monitoring
    logger.error(`${err.statusCode || 500} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`, {
        error: err.stack,
        body: req.body,
        params: req.params,
        query: req.query
    });

    // Default status code
    err.statusCode = err.statusCode || 500;

    // Normalize known error types
    const normalizedError = normalizeError(err);

    // Environment-specific error responses
    if (process.env.NODE_ENV === 'development') {
        sendDevError(normalizedError, res);
    } else {
        sendProdError(normalizedError, res);
    }
};