const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const { createCoupon, getAllCoupons, getCouponByCode, updateCoupon, deleteCoupon } = require('../controllers/couponController');

router.post('/', protect, admin, createCoupon);
router.get('/', protect, admin, getAllCoupons);
router.get('/:code', protect, admin, getCouponByCode);
router.put('/:id', protect, admin, updateCoupon);
router.delete('/:id', protect, admin, deleteCoupon);

module.exports = router;