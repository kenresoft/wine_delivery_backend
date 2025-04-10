const mongoose = require('mongoose');

const shipmentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  country: {
    type: String,
    required: [true, 'Country is required']
  },
  state: {
    type: String,
    required: [true, 'State/Province is required']
  },
  city: {
    type: String,
    required: [true, 'City is required']
  },
  company: {
    type: String,
    default: null
  },
  address: {
    type: String,
    required: [true, 'Street address is required']
  },
  apartment: {
    type: String,
    default: null
  },
  name: {
    type: String,
    required: [true, 'Recipient name is required']
  },
  zip: {
    type: String,
    required: [true, 'Postal/ZIP code is required']
  },
  note: {
    type: String,
    default: null
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required']
  },
  email: {
    type: String,
    required: [true, 'Email is required']
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  deliveryCost: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      delete ret.__v;
      delete ret.createdAt;
      delete ret.updatedAt;
      return ret;
    }
  }
});

// Index for better query performance
shipmentSchema.index({ user: 1, isDefault: -1 });

const Shipment = mongoose.model('Shipment', shipmentSchema);

module.exports = Shipment;