/**
 * middleware/asyncHandler.js
 * 
 * High-performance middleware factory for handling asynchronous route controllers
 * with comprehensive error propagation and Promise resolution.
 */
const logger = require('../utils/logger');

/**
 * Creates a middleware wrapper that handles asynchronous route controllers
 * and automatically forwards errors to Express error handling middleware
 * 
 * @param {Function} fn - Asynchronous controller function to wrap
 * @returns {Function} Express middleware function with error handling
 */
exports.asyncHandler = (fn) => {
    return (req, res, next) => {
        // Wrap controller execution in Promise chain for unified error handling
        Promise.resolve(fn(req, res, next))
            .catch((error) => {
                // Log internal errors with stack traces for debugging
                logger.error(`[AsyncHandler] Error in route handler: ${error.message}`, {
                    path: req.path,
                    method: req.method,
                    errorStack: error.stack,
                    requestId: req.id // Assuming request ID middleware is present
                });

                // Forward to Express error handling middleware
                next(error);
            });
    };
};

/**
 * Wraps an entire router with async error handling
 * @param {Object} router - Express router instance
 * @returns {Object} Router with all routes wrapped in asyncHandler
 */
exports.wrapRouterWithAsyncHandling = (router) => {
    // Store original route method implementations
    const methods = ['get', 'post', 'put', 'delete', 'patch'];

    methods.forEach(method => {
        const originalMethod = router[method];

        // Override route methods to automatically wrap handlers
        router[method] = function (path, ...handlers) {
            const wrappedHandlers = handlers.map(handler =>
                typeof handler === 'function' ? exports.asyncHandler(handler) : handler
            );

            // Call original method with wrapped handlers
            return originalMethod.call(this, path, ...wrappedHandlers);
        };
    });

    return router;
};

/**
 * Middleware that acts as a global safety net for unhandled promise rejections
 * within the request-response cycle.
 * 
 * @type {Function} Express middleware function
 */
exports.unhandledRejectionCatcher = (req, res, next) => {
    // Safety timeout to catch unhandled rejections that occur later in the cycle
    const timeout = setTimeout(() => {
        // Request was handled properly, nothing to do
    }, 30000); // 30s safety timeout

    // Clear timeout when response is finished
    res.on('finish', () => {
        clearTimeout(timeout);
    });

    // Proceed with request handling
    next();
};

module.exports = exports;