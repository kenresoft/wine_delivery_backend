class AppError extends Error {
  constructor(message, statusCode = 500, additionalData = {}, errorType = 'AppError') {
    super(message);

    this.statusCode = statusCode;
    this.success = false;
    this.isOperational = true;
    this.additionalData = additionalData;
    this.errorType = errorType;

    // Custom error code for logging and tracing
    this.errorCode = this._generateErrorCode(statusCode);
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }

  _generateErrorCode(statusCode) {
    const errorPrefix = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'VALIDATION',
      500: 'SERVER_ERROR'
    };

    const prefix = errorPrefix[statusCode] || 'APP_ERROR';
    const uniqueId = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}_${uniqueId}`;
  }

  toJSON() {
    return {
      success: false,
      message: this.message,
      errorCode: this.errorCode,
      errorType: this.errorType,
      timestamp: this.timestamp,
      ...(Object.keys(this.additionalData).length > 0 && { details: this.additionalData })
    };
  }
}

module.exports = AppError;
