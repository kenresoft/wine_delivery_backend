const mongoose = require('mongoose');

const shipmentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  country: {
    type: String,
    required: true
  },
  state: {
    type: String,
    required: true
  },
  city: {
    type: String,
    required: true
  },
  company: {
    type: String
  },
  address: {
    type: String,
    required: true
  },
  apartment: {
    type: String
  },
  name: {
    type: String,
    required: true
  },
  zip: {
    type: String,
    required: true
  },
  note: {
    type: String,
  },
});

const Shipment = mongoose.model('Shipment', shipmentSchema);
module.exports = Shipment;