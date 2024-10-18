const Cart = require('../models/Cart');
const Coupon = require('../models/Coupon');

exports.addToCart = async (req, res) => {
  try {
    const { productId: product, quantity } = req.body;
    const cart = await Cart.findOne({ user: req.user.id });
    if (cart) {
      const item = cart.items.find(item => item.product.toString() === product);
      if (item) {
        item.quantity += quantity;
      } else {
        cart.items.push({ product: product, quantity });
      }
      await cart.save();
    } else {
      await Cart.create({ user: req.user.id, items: [{ product, quantity }] });
    }
    res.status(201).json({ success: true, cart });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id })/* .populate('items.productId') */; //items.productId
    res.status(200).json({ success: true, cart });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.updateCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });
    const item = cart.items.find(item => item.product.toString() === req.params.itemId);
    if (item) {
      item.quantity = req.body.quantity;
      await cart.save();
      res.status(200).json({ success: true, cart });
    } else {
      res.status(404).json({ success: false, message: 'Item not found in cart' });
    }
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.removeFromCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });
    const itemIndex = cart.items.findIndex(item => item.product.toString() === req.params.itemId);
    if (itemIndex !== -1) {
      cart.items.splice(itemIndex, 1);
      await cart.save();
      res.status(200).json({ success: true, cart });
    } else {
      res.status(404).json({ success: false, message: 'Item not found in cart' });
    }
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.removeAllFromCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });
    if (cart) {
      cart.items = []; // Set the items array to an empty array
      await cart.save();
      res.status(200).json({ success: true, message: 'Cart emptied successfully' });
    } else {
      res.status(404).json({ success: false, message: 'Cart not found' });
    }
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.incrementCartItem = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });
    const item = cart.items.find(item => item.product.toString() === req.params.itemId);
    if (item) {
      item.quantity++;
      await cart.save();
      res.status(200).json({ success: true, cart });
    } else {
      res.status(404).json({ success: false, message: 'Item not found in cart' });
    }
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.decrementCartItem = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });
    const item = cart.items.find(item => item.product.toString() === req.params.itemId);
    if (item) {
      if (item.quantity > 1) {
        item.quantity--;
      } else {
        // Remove the item completely if quantity reaches 0
        const itemIndex = cart.items.findIndex(innerItem => innerItem._id.toString() === item._id.toString());
        cart.items.splice(itemIndex, 1);
      }
      await cart.save();
      res.status(200).json({ success: true, cart });
    } else {
      res.status(404).json({ success: false, message: 'Item not found in cart' });
    }
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.getCartTotalPrice = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id }).populate('items.product');
    if (cart) {
      let totalPrice = await this.getTotalPrice(cart, req);

      res.status(200).json({ success: true, totalPrice });
    } else {
      res.status(404).json({ success: false, message: 'Cart not found' });
    }
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.getTotalPrice = async (cart, req) => {
  let totalPrice = 0;
  for (const item of cart.items) {
    totalPrice += item.product.defaultPrice * item.quantity;
  }

  // Apply coupon code discount if valid
  const couponCode = req.body.couponCode; // Assuming coupon code is sent in the request body
  if (couponCode) {
    const coupon = await Coupon.findOne({ code: couponCode, isActive: true });
    if (coupon && coupon.expiryDate > new Date()) {
      if (!coupon.minimumPurchaseAmount || totalPrice >= coupon.minimumPurchaseAmount) {
        const discountAmount = totalPrice * (coupon.discount / 100);
        totalPrice -= discountAmount;
      }
    }
  }
  // console.log(totalPrice);
  return totalPrice;
}
