const express = require('express');
const router = express.Router();
const { isAuthenticated: protect } = require('../middleware/authMiddleware');
const { getShipmentDetails, createShipmentDetails, getShipmentDetailsById, updateShipmentDetails } = require('../controllers/shipmentController');

// Get all delivery addresses for a user (protected route)
router.get('/', protect, getShipmentDetails);

// Create a new delivery address (protected route)
router.post('/', protect, createShipmentDetails);

// Get a specific delivery address by ID (protected route)
router.get('/:id', protect, getShipmentDetailsById);

// Update a specific delivery address (protected route)
router.put('/:id', protect, updateShipmentDetails);
module.exports = router;