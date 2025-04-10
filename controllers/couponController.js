const Coupon = require('../models/Coupon');
const logger = require('../utils/logger');

/**
 * Create a new coupon
 * @route POST /api/coupons
 * @access Private/Admin
 */
exports.createCoupon = async (req, res) => {
  try {
    const { code, discount, discountType, minimumPurchaseAmount, expiryDate } = req.body;

    // Check if coupon code already exists
    const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (existingCoupon) {
      return res.status(409).json({ 
        success: false, 
        message: 'Coupon code already exists' 
      });
    }

    const newCoupon = new Coupon({
      code: code.toUpperCase(),
      discount,
      discountType: discountType || 'percentage',
      minimumPurchaseAmount: minimumPurchaseAmount || 0,
      expiryDate,
      createdBy: req.user.id
    });

    await newCoupon.save();
    logger.info(`Coupon created: ${newCoupon.code}`);
    
    res.status(201).json({ 
      success: true, 
      coupon: newCoupon 
    });
  } catch (error) {
    logger.error(`Coupon creation error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create coupon' 
    });
  }
};

/**
 * Get all coupons with optional filtering
 * @route GET /api/coupons
 * @access Private/Admin
 */
exports.getAllCoupons = async (req, res) => {
  try {
    const { active, sort, limit = 10, page = 1 } = req.query;
    const query = {};
    
    if (active === 'true') {
      query.expiryDate = { $gt: new Date() };
    } else if (active === 'false') {
      query.expiryDate = { $lte: new Date() };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    let sortOptions = { createdAt: -1 };
    if (sort === 'discount') sortOptions = { discount: -1 };
    if (sort === 'expiry') sortOptions = { expiryDate: 1 };

    const [coupons, totalCount] = await Promise.all([
      Coupon.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Coupon.countDocuments(query)
    ]);

    const enhancedCoupons = coupons.map(coupon => ({
      ...coupon,
      isActive: new Date(coupon.expiryDate) > new Date()
    }));

    res.status(200).json({ 
      success: true, 
      coupons: enhancedCoupons,
      pagination: {
        totalCount,
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        currentPage: parseInt(page),
        hasMore: skip + enhancedCoupons.length < totalCount
      }
    });
  } catch (error) {
    logger.error(`Get all coupons error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to retrieve coupons' 
    });
  }
};

/**
 * Get coupon by code
 * @route GET /api/coupons/:code
 * @access Private
 */
exports.getCouponByCode = async (req, res) => {
  try {
    const couponCode = req.params.code.toUpperCase();
    
    const coupon = await Coupon.findOne({ code: couponCode });
    if (!coupon) {
      return res.status(404).json({ 
        success: false, 
        message: 'Coupon not found' 
      });
    }

    const isExpired = new Date(coupon.expiryDate) <= new Date();
    
    res.status(200).json({ 
      success: true, 
      coupon: {
        ...coupon.toObject(),
        isExpired
      }
    });
  } catch (error) {
    logger.error(`Get coupon by code error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to retrieve coupon' 
    });
  }
};

/**
 * Update coupon by ID
 * @route PUT /api/coupons/:id
 * @access Private/Admin
 */
exports.updateCoupon = async (req, res) => {
  try {
    const { code, discount, discountType, minimumPurchaseAmount, expiryDate } = req.body;
    
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({ 
        success: false, 
        message: 'Coupon not found' 
      });
    }

    if (code && code !== coupon.code) {
      const existingCoupon = await Coupon.findOne({ 
        code: code.toUpperCase(),
        _id: { $ne: coupon._id }
      });
      
      if (existingCoupon) {
        return res.status(409).json({ 
          success: false, 
          message: 'Coupon code already exists' 
        });
      }
      
      coupon.code = code.toUpperCase();
    }

    if (discount !== undefined) coupon.discount = discount;
    if (discountType !== undefined) coupon.discountType = discountType;
    if (minimumPurchaseAmount !== undefined) coupon.minimumPurchaseAmount = minimumPurchaseAmount;
    if (expiryDate) coupon.expiryDate = expiryDate;
    
    coupon.updatedAt = Date.now();
    coupon.updatedBy = req.user.id;

    await coupon.save();
    logger.info(`Coupon updated: ${coupon.code}`);
    
    res.status(200).json({ 
      success: true, 
      coupon 
    });
  } catch (error) {
    logger.error(`Update coupon error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update coupon' 
    });
  }
};

/**
 * Delete coupon by ID
 * @route DELETE /api/coupons/:id
 * @access Private/Admin
 */
exports.deleteCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({ 
        success: false, 
        message: 'Coupon not found' 
      });
    }

    await Coupon.findByIdAndDelete(req.params.id);
    logger.info(`Coupon deleted: ${coupon.code}`);
    
    res.status(200).json({ 
      success: true, 
      message: 'Coupon successfully deleted' 
    });
  } catch (error) {
    logger.error(`Delete coupon error: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete coupon' 
    });
  }
};

/**
 * Validate a coupon for a specific order amount
 * @route POST /api/coupons/validate
 * @access Private
 */
exports.validateCoupon = async (req, res) => {
  try {
    const { code, orderAmount } = req.body;
    const coupon = await Coupon.findOne({ code: code.toUpperCase() });
    
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Invalid coupon code'
      });
    }

    if (new Date(coupon.expiryDate) <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Coupon has expired'
      });
    }

    if (orderAmount && coupon.minimumPurchaseAmount > orderAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum purchase amount of $${coupon.minimumPurchaseAmount} required`
      });
    }

    let discountAmount = 0;
    if (coupon.discountType === 'percentage') {
      discountAmount = (orderAmount * coupon.discount) / 100;
    } else {
      discountAmount = coupon.discount;
    }

    res.status(200).json({
      success: true,
      coupon: {
        ...coupon.toObject(),
        discountAmount: parseFloat(discountAmount.toFixed(2))
      }
    });
  } catch (error) {
    logger.error(`Validate coupon error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to validate coupon'
    });
  }
};