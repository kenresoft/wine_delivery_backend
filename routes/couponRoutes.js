const express = require('express');
const router = express.Router();
const { isAuthenticated: protect, admin } = require('../middleware/authMiddleware');
const {
    createCoupon,
    getAllCoupons,
    getCouponByCode,
    updateCoupon,
    deleteCoupon,
    validateCoupon
} = require('../controllers/couponController');
const { validateCouponInputs, validateCouponUpdate, validateCouponValidation } = require('../validators/couponValidator');

// Admin routes
router.route('/')
    .post(protect, /* admin, */ validateCouponInputs, createCoupon)
    .get(protect, /* admin, */ getAllCoupons);

router.route('/:id')
    .put(protect, admin, validateCouponUpdate, updateCoupon)
    .delete(protect, admin, deleteCoupon);

// Public/authenticated routes
router.route('/validate').post(protect, validateCouponValidation, validateCoupon);
router.route('/:code').get(protect, getCouponByCode);

module.exports = router;