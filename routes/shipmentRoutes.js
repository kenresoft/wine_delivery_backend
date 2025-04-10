const express = require('express');
const router = express.Router();
const { isAuthenticated: protect, admin } = require('../middleware/authMiddleware');
const {
  getShipmentDetails,
  createShipmentDetails,
  getShipmentDetailsById,
  updateShipmentDetails,
  deleteShipmentDetails,
  calculateShippingCost,
  getUserAddresses,
  setDefaultAddress
} = require('../controllers/shipmentController');

// Base route: /api/shipments

// Get all shipment addresses for authenticated user
router.get('/', protect, getUserAddresses);

// Get default shipment details for authenticated user
router.get('/default', protect, getShipmentDetails);

// Calculate shipping costs
router.post('/calculate', protect, calculateShippingCost);

// Create new shipment address
router.post('/', protect, createShipmentDetails);

// Get specific shipment address by ID
router.get('/:id', protect, getShipmentDetailsById);

// Update shipment address
router.put('/:id', protect, updateShipmentDetails);

// Delete shipment address
router.delete('/:id', protect, deleteShipmentDetails); 

// Set default address
router.put('/:id/default', protect, setDefaultAddress);

module.exports = router;