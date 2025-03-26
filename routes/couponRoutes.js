const express = require('express');
const router = express.Router();
const { isAuthenticated: protect, admin } = require('../middleware/authMiddleware');
const { createCoupon, getAllCoupons, getCouponByCode, updateCoupon, deleteCoupon } = require('../controllers/couponController');

router.post('/', protect, admin, createCoupon);
router.get('/', protect, getAllCoupons);
router.get('/:code', protect, getCouponByCode);
router.put('/:id', protect, admin, updateCoupon);
router.delete('/:id', protect, admin, deleteCoupon);

module.exports = router;