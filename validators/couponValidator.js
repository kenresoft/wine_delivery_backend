const { body, param, query } = require('express-validator');
const Coupon = require('../models/Coupon');
const { isValidDate } = require('../utils/helpers');

// Common validation messages
const messages = {
    required: field => `${field} is required`,
    invalid: field => `Invalid ${field}`,
    min: (field, value) => `${field} must be at least ${value}`,
    max: (field, value) => `${field} cannot exceed ${value}`,
    futureDate: field => `${field} must be in the future`
};

// Shared validation rules
const couponCodeRules = (field = 'code') => [
    body(field) 
        .trim()
        .notEmpty().withMessage(messages.required('Coupon code'))
        .isLength({ min: 4 }).withMessage(messages.min('Coupon code', 4))
        .isLength({ max: 20 }).withMessage(messages.max('Coupon code', 20))
        .customSanitizer(value => value.toUpperCase())
];

const discountRules = [
    body('discount')
        .notEmpty().withMessage(messages.required('Discount'))
        .isFloat({ min: 0.01 }).withMessage('Discount must be greater than 0')
        .toFloat()
];

const expiryDateRules = [
    body('expiryDate')
        .notEmpty().withMessage(messages.required('Expiry date'))
        .custom(isValidDate).withMessage(messages.invalid('date format'))
        .custom(value => new Date(value) > new Date()).withMessage(messages.futureDate('Expiry date'))
];

// Validator sets
exports.validateCouponInputs = [
    ...couponCodeRules(),
    ...discountRules,
    body('discountType')
        .optional()
        .isIn(['percentage', 'fixed']).withMessage('Discount type must be either "percentage" or "fixed"'),
    body('minimumPurchaseAmount')
        .optional()
        .isFloat({ min: 0 }).withMessage('Minimum purchase amount cannot be negative')
        .toFloat(),
    ...expiryDateRules
];

exports.validateCouponUpdate = [
    param('id')
        .isMongoId().withMessage(messages.invalid('coupon ID')),
    ...couponCodeRules('code'),
    body('discount')
        .optional()
        .isFloat({ min: 0.01 }).withMessage('Discount must be greater than 0')
        .toFloat(),
    body('minimumPurchaseAmount')
        .optional()
        .isFloat({ min: 0 }).withMessage('Minimum purchase amount cannot be negative')
        .toFloat(),
    ...expiryDateRules.map(rule => rule.optional())
];

exports.validateCouponValidation = [
    body('code')
        .trim()
        .notEmpty().withMessage(messages.required('Coupon code'))
        .isLength({ min: 4 }).withMessage(messages.min('Coupon code', 4))
        .isLength({ max: 20 }).withMessage(messages.max('Coupon code', 20))
        .customSanitizer(value => value.toUpperCase()),
    body('orderAmount')
        .optional()
        .isFloat({ min: 0 }).withMessage('Order amount cannot be negative')
        .toFloat()
];

// Query validations for getAllCoupons
exports.validateCouponQueryParams = [
    query('active')
        .optional()
        .isIn(['true', 'false']).withMessage('Active filter must be "true" or "false"'),
    query('sort')
        .optional()
        .isIn(['discount', 'expiry', 'createdAt']).withMessage('Invalid sort parameter'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
        .toInt(),
    query('page')
        .optional()
        .isInt({ min: 1 }).withMessage('Page must be at least 1')
        .toInt()
];