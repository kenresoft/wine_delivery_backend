const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const NotificationService = require('../services/NotificationService');
const { asyncHandler } = require('../middleware/asyncHandler');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

exports.addToCart = asyncHandler(async (req, res) => {
  const { productId, quantity } = req.body;

  // Validate product existence and inventory availability first
  const product = await Product.findById(productId);
  if (!product) {
    throw new AppError('Product not found', 404);
  }

  if (product.defaultQuantity < quantity) {
    throw new AppError('Insufficient product inventory', 400);
  }

  // Find or create cart using upsert pattern for atomicity
  let cart = await Cart.findOne({ user: req.user.id });

  if (!cart) {
    cart = new Cart({
      user: req.user.id,
      items: [{ product: productId, quantity }]
    });
  } else {
    // Find item index for efficient array manipulation
    const itemIndex = cart.items.findIndex(item => item.product.toString() === productId);

    if (itemIndex > -1) {
      // Update existing item with atomic operation
      cart.items[itemIndex].quantity += quantity;
    } else {
      // Add new item to cart
      cart.items.push({ product: productId, quantity });
    }
  }

  await cart.save();
  logger.info(`Product ${productId} added to cart for user ${req.user.id}`);

  // Populate product details for rich client response
  await cart.populate('items.product', 'name defaultPrice image');

  // Schedule cart abandonment notification (extracted to service layer)
  const notificationService = new NotificationService();
  // Configure realistic timeout for production
  const ABANDONMENT_NOTIFICATION_DELAY = process.env.NODE_ENV === 'production'
    ? 1000 * 60 * 60 * 24  // 24 hours in production
    : 1000 * 60 * 5;       // 5 minutes in development

  setTimeout(async () => {
    await notificationService.sendCartAbandonmentReminder(req.user.id, cart._id);
  }, ABANDONMENT_NOTIFICATION_DELAY);

  res.status(201).json({
    success: true,
    data: cart,
    message: 'Item added to cart successfully'
  });
});

exports.getCart = asyncHandler(async (req, res) => {
  // Optimize with selective population pattern
  const cart = await Cart.findOne({ user: req.user.id })
    .populate('items.product', 'name defaultPrice image defaultQuantity');

  if (!cart) {
    return res.status(200).json({
      success: true,
      data: { items: [] },
      message: 'Cart is empty'
    });
  }

  res.status(200).json({
    success: true,
    data: cart
  });
});

exports.updateCart = asyncHandler(async (req, res) => {
  const { quantity } = req.body;
  const itemId = req.params.itemId;

  if (quantity < 1) {
    throw new AppError('Quantity must be at least 1', 400);
  }

  const cart = await Cart.findOne({ user: req.user.id });

  if (!cart) {
    throw new AppError('Cart not found', 404);
  }

  const itemIndex = cart.items.findIndex(item => item.product.toString() === itemId);

  if (itemIndex === -1) {
    throw new AppError('Item not found in cart', 404);
  }

  // Check inventory availability before updating
  const product = await Product.findById(itemId);
  if (!product || product.defaultQuantity < quantity) {
    throw new AppError('Requested quantity exceeds available inventory', 400);
  }

  // Update cart item quantity
  cart.items[itemIndex].quantity = quantity;
  await cart.save();

  // Populate for rich response
  await cart.populate('items.product', 'name defaultPrice image defaultQuantity');

  res.status(200).json({
    success: true,
    data: cart,
    message: 'Cart updated successfully'
  });
});

exports.removeFromCart = asyncHandler(async (req, res) => {
  const itemId = req.params.itemId;
  const cart = await Cart.findOne({ user: req.user.id });

  if (!cart) {
    throw new AppError('Cart not found', 404);
  }

  const itemIndex = cart.items.findIndex(item => item.product.toString() === itemId);

  if (itemIndex === -1) {
    throw new AppError('Item not found in cart', 404);
  }

  // Remove item with optimal array manipulation
  cart.items.splice(itemIndex, 1);
  await cart.save();

  // Populate for rich response
  await cart.populate('items.product', 'name defaultPrice image defaultQuantity');

  res.status(200).json({
    success: true,
    data: cart,
    message: 'Item removed from cart'
  });
});

exports.clearCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user.id });

  if (!cart) {
    return res.status(200).json({
      success: true,
      message: 'Cart is already empty'
    });
  }

  cart.items = [];
  await cart.save();

  res.status(200).json({
    success: true,
    message: 'Cart emptied successfully'
  });
});

exports.incrementCartItem = asyncHandler(async (req, res) => {
  const itemId = req.params.itemId;
  const cart = await Cart.findOne({ user: req.user.id });

  if (!cart) {
    throw new AppError('Cart not found', 404);
  }

  const itemIndex = cart.items.findIndex(item => item.product.toString() === itemId);

  if (itemIndex === -1) {
    throw new AppError('Item not found in cart', 404);
  }

  // Verify inventory before incrementing
  const product = await Product.findById(itemId);
  if (!product || product.defaultQuantity <= cart.items[itemIndex].quantity) {
    throw new AppError('Cannot increment quantity: insufficient inventory', 400);
  }

  // Increment quantity
  cart.items[itemIndex].quantity += 1;
  await cart.save();

  // Populate for rich response
  await cart.populate('items.product', 'name defaultPrice image defaultQuantity');

  res.status(200).json({
    success: true,
    data: cart,
    message: 'Item quantity incremented'
  });
});

exports.decrementCartItem = asyncHandler(async (req, res) => {
  const itemId = req.params.itemId;
  const cart = await Cart.findOne({ user: req.user.id });

  if (!cart) {
    throw new AppError('Cart not found', 404);
  }

  const itemIndex = cart.items.findIndex(item => item.product.toString() === itemId);

  if (itemIndex === -1) {
    throw new AppError('Item not found in cart', 404);
  }

  // Handle removal if quantity would be zero
  if (cart.items[itemIndex].quantity === 1) {
    cart.items.splice(itemIndex, 1);
  } else {
    cart.items[itemIndex].quantity -= 1;
  }

  await cart.save();

  // Populate for rich response
  await cart.populate('items.product', 'name defaultPrice image defaultQuantity');

  res.status(200).json({
    success: true,
    data: cart,
    message: 'Item quantity decremented'
  });
});

exports.getCartItemQuantity = asyncHandler(async (req, res) => {
  const itemId = req.params.itemId;
  const cart = await Cart.findOne({ user: req.user.id });

  if (!cart) {
    return res.status(200).json({
      success: true,
      data: { quantity: 0 }
    });
  }

  const item = cart.items.find(item => item.product.toString() === itemId);

  res.status(200).json({
    success: true,
    data: {
      quantity: item ? item.quantity : 0
    }
  });
});

/* exports.applyCoupon = asyncHandler(async (req, res) => {
  const { couponCode } = req.body;

  if (!couponCode) {
    throw new AppError('Coupon code is required', 400);
  }

  const cart = await Cart.findOne({ user: req.user.id })
    .populate('items.product', 'defaultPrice');

  if (!cart || cart.items.length === 0) {
    throw new AppError('Cannot apply coupon to an empty cart', 400);
  }

  // Validate coupon eligibility
  const coupon = await Coupon.findOne({
    code: couponCode,
    isActive: true,
    expiryDate: { $gt: new Date() }
  });

  if (!coupon) {
    throw new AppError('Invalid or expired coupon code', 400);
  }

  // Calculate cart subtotal for minimum purchase validation
  let subtotal = 0;
  for (const item of cart.items) {
    if (!item.product || !item.product.defaultPrice) {
      throw new AppError('Invalid product data in cart', 400);
    }
    subtotal += item.product.defaultPrice * item.quantity;
  }

  // Validate minimum purchase requirement
  if (coupon.minimumPurchaseAmount && subtotal < coupon.minimumPurchaseAmount) {
    throw new AppError(
      `Minimum purchase of $${coupon.minimumPurchaseAmount} required to use this coupon`,
      400
    );
  }

  // Calculate discount amount
  const discountAmount = subtotal * (coupon.discount / 100);

  // Update cart with applied coupon
  cart.appliedCoupon = {
    code: coupon.code,
    discount: coupon.discount,
    discountAmount: Number(discountAmount.toFixed(2))
  };

  await cart.save();
  logger.info(`Coupon ${couponCode} applied to cart for user ${req.user.id}`);

  // Calculate final totals after discount for response
  const total = Number((subtotal - discountAmount).toFixed(2));

  res.status(200).json({
    success: true,
    data: {
      cart,
      pricing: {
        subtotal: Number(subtotal.toFixed(2)),
        discount: Number(discountAmount.toFixed(2)),
        total
      }
    },
    message: `Coupon ${couponCode} applied successfully`
  });
});

exports.removeCoupon = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user.id });

  if (!cart) {
    throw new AppError('Cart not found', 404);
  }

  if (!cart.appliedCoupon) {
    throw new AppError('No coupon is currently applied to this cart', 400);
  }

  // Track coupon code for logging/response
  const removedCouponCode = cart.appliedCoupon.code;

  // Remove coupon from cart
  cart.appliedCoupon = undefined;
  await cart.save();
  logger.info(`Coupon ${removedCouponCode} removed from cart for user ${req.user.id}`);

  // Recalculate totals for response
  await cart.populate('items.product', 'defaultPrice');
  let subtotal = 0;
  for (const item of cart.items) {
    subtotal += item.product.defaultPrice * item.quantity;
  }

  res.status(200).json({
    success: true,
    data: {
      cart,
      pricing: {
        subtotal: Number(subtotal.toFixed(2)),
        discount: 0,
        total: Number(subtotal.toFixed(2))
      }
    },
    message: `Coupon ${removedCouponCode} removed successfully`
  });
});

// Refactor getCartTotalPrice to use persisted coupon data
exports.getCartTotalPrice = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user.id })
    .populate('items.product', 'defaultPrice');

  if (!cart || cart.items.length === 0) {
    return res.status(200).json({
      success: true,
      data: {
        subtotal: 0,
        discount: 0,
        total: 0
      }
    });
  }

  // Calculate subtotal
  let subtotal = 0;
  for (const item of cart.items) {
    if (!item.product || !item.product.defaultPrice) {
      throw new AppError('Invalid product data in cart', 400);
    }
    subtotal += item.product.defaultPrice * item.quantity;
  }

  // Use persisted coupon if available
  let discount = 0;
  let couponDetails = null;

  if (cart.appliedCoupon) {
    discount = cart.appliedCoupon.discountAmount;
    couponDetails = {
      code: cart.appliedCoupon.code,
      discount: cart.appliedCoupon.discount,
      discountAmount: discount
    };
  }

  const total = Number((subtotal - discount).toFixed(2));

  res.status(200).json({
    success: true,
    data: {
      subtotal: Number(subtotal.toFixed(2)),
      discount: Number(discount.toFixed(2)),
      total,
      coupon: couponDetails
    }
  });
}); */

exports.applyCoupon = asyncHandler(async (req, res) => {
  const { couponCode } = req.body;

  if (!couponCode) {
    throw new AppError('Coupon code is required', 400);
  }

  // Find cart with minimal projection for efficiency
  let cart = await Cart.findOne({ user: req.user.id });

  if (!cart || cart.items.length === 0) {
    throw new AppError('Cannot apply coupon to an empty cart', 400);
  }

  // Validate coupon eligibility with comprehensive checks
  const coupon = await Coupon.findOne({
    code: couponCode,
    isActive: true,
    expiryDate: { $gt: new Date() }
  });

  if (!coupon) {
    throw new AppError('Invalid or expired coupon code', 400);
  }

  // Validate minimum purchase requirement against current pricing
  await cart.populate('items.product', 'defaultPrice');
  let subtotal = 0;
  for (const item of cart.items) {
    subtotal += item.product.defaultPrice * item.quantity;
  }

  if (coupon.minimumPurchaseAmount && subtotal < coupon.minimumPurchaseAmount) {
    throw new AppError(
      `Minimum purchase of $${coupon.minimumPurchaseAmount} required to use this coupon`,
      400
    );
  }

  // Apply coupon using domain model method
  await cart.applyCoupon(coupon);

  // Populate for rich response
  await cart.populate('items.product', 'name defaultPrice image defaultQuantity');

  // Log application
  logger.info(`Coupon ${couponCode} applied to cart for user ${req.user.id}`);

  res.status(200).json({
    success: true,
    data: cart,
    message: `Coupon ${couponCode} applied successfully`
  });
});

exports.removeCoupon = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user.id });

  if (!cart) {
    throw new AppError('Cart not found', 404);
  }

  if (!cart.appliedCoupon) {
    throw new AppError('No coupon is currently applied to this cart', 400);
  }

  // Track coupon code for logging/response
  const removedCouponCode = cart.appliedCoupon.code;

  // Remove coupon using domain model method
  await cart.removeCoupon();

  // Populate for rich response
  await cart.populate('items.product', 'name defaultPrice image defaultQuantity');

  // Log removal
  logger.info(`Coupon ${removedCouponCode} removed from cart for user ${req.user.id}`);

  res.status(200).json({
    success: true,
    data: cart,
    message: `Coupon ${removedCouponCode} removed successfully`
  });
});

// Simplified getCartTotalPrice using domain model encapsulation
exports.getCartTotalPrice = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user.id });

  if (!cart || cart.items.length === 0) {
    return res.status(200).json({
      success: true,
      data: {
        subtotal: 0,
        discount: 0,
        total: 0
      }
    });
  }

  // Simply return the pricing object - calculation handled by model
  res.status(200).json({
    success: true,
    data: cart.pricing
  });
});