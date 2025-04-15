const Promotion = require("../models/Promotion");
const Product = require("../models/Product");
const User = require("../models/User");
const logger = require("../utils/logger");
const { asyncHandler } = require('../middleware/asyncHandler');
const AppError = require("../utils/AppError");

// Helper: Generate random promo code
const generatePromoCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join("");
};

// Helper: Calculate safe discounted price
const calculateDiscount = (originalPrice, promotion) => {
  let discountedPrice = originalPrice;
  if (promotion.discountType === "percentage") {
    const discountAmount = originalPrice * (promotion.discountValue / 100);
    discountedPrice -=
      promotion.maximumDiscount && discountAmount > promotion.maximumDiscount
        ? promotion.maximumDiscount
        : discountAmount;
  } else if (promotion.discountType === "fixed") {
    discountedPrice -= promotion.discountValue;
  }
  return Math.max(0, Math.min(originalPrice, discountedPrice)).toFixed(2);
};

// Helper: Check user eligibility
const isUserEligible = async (user, promotion) => {
  // Location check
  if (
    promotion.locations.length > 0 &&
    user?.location &&
    !promotion.locations.includes(user.location.toLowerCase())
  ) {
    return false;
  }

  // First-purchase check
  if (promotion.isFirstPurchaseOnly && user?.orderHistory?.length > 0) {
    return false;
  }

  // User inclusion/exclusion
  if (user?._id) {
    if (
      promotion.includedUsers.length > 0 &&
      !promotion.includedUsers.some((id) => id.equals(user._id))
    ) {
      return false;
    }
    if (promotion.excludedUsers.some((id) => id.equals(user._id))) {
      return false;
    }
  }

  return true;
};

// 1. CREATE - Add new promotion
exports.createPromotion = asyncHandler(async (req, res) => {
  const promotionData = {
    ...req.body,
    code: req.body.code || generatePromoCode(),
    isVisible: req.body.isVisible ?? true,
  };

  const promotion = await Promotion.create(promotionData);
  logger.info(`Promotion created: ${promotion.code} (ID: ${promotion._id})`);

  res.status(201).json({
    success: true,
    data: promotion,
  });
});

// 2. READ - Get all promotions (with filtering)
exports.getAllPromotions = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, isActive, discountType } = req.query;
  const filter = {};

  // Filter by active status
  if (isActive === 'true') {
    const now = new Date();
    filter.startDate = { $lte: now };
    filter.endDate = { $gte: now };
    filter.isActive = true;
  }

  // Filter by discount type
  if (discountType && ['percentage', 'fixed', 'freeShipping'].includes(discountType)) {
    filter.discountType = discountType;
  }

  const promotions = await Promotion.find(filter)
    .skip((page - 1) * limit)
    .limit(limit);

  logger.info(`Fetched ${promotions.length} promotions`);

  res.status(200).json({
    success: true,
    count: promotions.length,
    data: promotions,
  });
});

// 3. READ - Get single promotion by ID
exports.getPromotion = asyncHandler(async (req, res, next) => {
  const promotion = await Promotion.findById(req.params.id);

  if (!promotion) {
    logger.warn(`Promotion not found with ID: ${req.params.id}`);
    return next(
      new AppError(`Promotion not found with ID: ${req.params.id}`, 404, {
        code: "PROMO_NOT_FOUND",
      })
    );
  }

  logger.info(`Fetched promotion: ${promotion.code} (ID: ${promotion._id})`);
  res.status(200).json({
    success: true,
    data: promotion,
  });
});

// 4. UPDATE - Update promotion by ID
exports.updatePromotion = asyncHandler(async (req, res, next) => {
  let promotion = await Promotion.findById(req.params.id);

  if (!promotion) {
    logger.warn(`Promotion not found for update: ${req.params.id}`);
    return next(
      new AppError(`Promotion not found with ID: ${req.params.id}`, 404, {
        code: "PROMO_NOT_FOUND",
      })
    );
  }

  // Prevent code changes if already set
  if (promotion.code && req.body.code && promotion.code !== req.body.code) {
    logger.warn(`Attempted to modify promotion code: ${promotion.code} -> ${req.body.code}`);
    return next(
      new AppError("Promotion code cannot be modified once set", 400, {
        code: "IMMUTABLE_CODE",
      })
    );
  }

  promotion = await Promotion.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  logger.info(`Updated promotion: ${promotion.code} (ID: ${promotion._id})`);
  res.status(200).json({
    success: true,
    data: promotion,
  });
});

// 5. DELETE - Delete promotion by ID
exports.deletePromotion = asyncHandler(async (req, res, next) => {
  const promotion = await Promotion.findById(req.params.id);

  if (!promotion) {
    logger.warn(`Promotion not found for deletion: ${req.params.id}`);
    return next(
      new AppError(`Promotion not found with ID: ${req.params.id}`, 404, {
        code: "PROMO_NOT_FOUND",
      })
    );
  }

  await promotion.deleteOne();
  logger.info(`Deleted promotion: ${promotion.code} (ID: ${promotion._id})`);

  res.status(200).json({
    success: true,
    data: {},
  });
});

// 6. SPECIAL - Get products by promotion
exports.getProductsByPromotion = asyncHandler(async (req, res, next) => {
  const { promotionCode } = req.params;
  const userId = req.user?._id;

  const promotion = await Promotion.findOne({
    code: promotionCode,
    // isActive: true,
    // startDate: { $lte: new Date() },
    // endDate: { $gte: new Date() },
  });

  if (!promotion) {
    logger.warn(`Promotion not found or expired: ${promotionCode}`);
    return next(
      new AppError("Promotion not found or expired", 404, {
        code: "PROMO_NOT_FOUND",
      })
    );
  }

  // Check visibility and eligibility
  if (!promotion.isVisible && !userId) {
    logger.warn(`Unauthorized access attempt to private promotion: ${promotionCode}`);
    return next(
      new AppError("Log in to check eligibility for this promotion", 403, {
        code: "LOGIN_REQUIRED",
      })
    );
  }

  const user = userId ? await User.findById(userId).select("location orderHistory") : null;
  if (!promotion.isVisible && !(await isUserEligible(user, promotion))) {
    logger.warn(`Ineligible user attempted to access promotion: ${userId} -> ${promotionCode}`);
    return next(
      new AppError("You don't qualify for this promotion", 403, {
        code: "PROMO_NOT_ELIGIBLE",
      })
    );
  }

  // Fetch products with aggregation
  const products = await Product.aggregate([
    {
      $match: {
        $or: [
          { _id: { $in: promotion.applicableProducts } },
          { category: { $in: promotion.applicableCategories } },
        ],
        stock: { $gt: 0 },
      },
    },
  ]);

  // Apply discounts and log low stock
  const LOW_STOCK_THRESHOLD = 10;
  const discountedProducts = products.map((product) => {
    if (product.stock < LOW_STOCK_THRESHOLD) {
      logger.warn(`Low stock for promoted product: ${product.name} (ID: ${product._id})`);
    }

    return {
      ...product,
      discountedPrice: calculateDiscount(product.defaultPrice, promotion),
      originalPrice: product.defaultPrice,
      isEligible: userId ? isUserEligible(user, promotion) : false,
    };
  });

  logger.info(`Fetched ${discountedProducts.length} products for promotion: ${promotion.code}`);
  res.status(200).json({
    success: true,
    count: discountedProducts.length,
    data: discountedProducts,
  });
});

// 7. SPECIAL - Batch eligibility check
exports.checkBulkEligibility = asyncHandler(async (req, res, next) => {
  const { promotionIds } = req.body;
  const userId = req.user._id;

  if (!promotionIds || !Array.isArray(promotionIds)) {
    logger.error(`Invalid promotion IDs provided: ${promotionIds}`);
    return next(
      new AppError("Invalid promotion IDs", 400, {
        code: "INVALID_INPUT",
      })
    );
  }

  const user = await User.findById(userId).select("location orderHistory");
  const promotions = await Promotion.find({
    _id: { $in: promotionIds },
    isActive: true,
  });

  const results = await Promise.all(
    promotions.map(async (promo) => ({
      _id: promo._id,
      code: promo.code,
      isEligible: await isUserEligible(user, promo),
    }))
  );

  logger.info(`Checked eligibility for ${results.length} promotions (User: ${userId})`);
  res.status(200).json({
    success: true,
    count: results.length,
    data: results,
  });
});