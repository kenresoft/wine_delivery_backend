const Coupon = require('../models/Coupon');
exports.createCoupon = async (req, res) => {
  try {
    const { code, discount, minimumPurchaseAmount, expiryDate } = req.body;

    const newCoupon = new Coupon({
      code,
      discount,
      minimumPurchaseAmount,
      expiryDate
    });

    await newCoupon.save();
    res.status(201).json({ success: true, coupon: newCoupon });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.getAllCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find();
    res.status(200).json({ success: true, coupons });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.getCouponByCode = async (req, res) => {
  try {
    const coupon = await Coupon.findOne({ code: req.params.code });
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }
    res.status(200).json({ success: true, coupon });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.updateCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    const { code, discount, minimumPurchaseAmount, expiryDate } = req.body;

    coupon.code = code;
    coupon.discount = discount;
    coupon.minimumPurchaseAmount = minimumPurchaseAmount;
    coupon.expiryDate = expiryDate;

    await coupon.save();
    res.status(200).json({ success: true, coupon });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.deleteCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }
    res.status(204).json({ success: true, message: 'Coupon deleted' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};