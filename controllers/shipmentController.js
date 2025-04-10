const Shipment = require('../models/Shipment');

/**
 * Get shipment details for authenticated user
 * @route GET /api/shipments
 * @access Private
 */
exports.getShipmentDetails = async (req, res) => {
    try {
        const shipment = await Shipment.findOne({ user: req.user.id });
        
        if (!shipment) {
            return res.status(200).json({ 
                success: true, 
                shipment: null,
                message: 'No shipment details found for this user'
            });
        }
        
        res.status(200).json({ 
            success: true, 
            shipment
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: 'Failed to retrieve shipment details' 
        });
    }
};

/**
 * Create or update shipment details for authenticated user
 * @route POST /api/shipments
 * @access Private
 */
exports.createShipmentDetails = async (req, res) => {
    try {
        const { 
            country, 
            state, 
            city, 
            company, 
            address, 
            apartment, 
            name, 
            zip, 
            note,
            phone,
            email,
            isDefault
        } = req.body;

        // Required fields validation
        const requiredFields = { name, address, city, state, country, zip, phone, email };
        const missingFields = Object.entries(requiredFields)
            .filter(([key, value]) => !value)
            .map(([key]) => key);

        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Missing required fields: ${missingFields.join(', ')}`
            });
        }

        // Check if shipment exists for user
        const existingShipment = await Shipment.findOne({ user: req.user.id });

        let shipment;
        if (existingShipment) {
            // Update existing shipment
            existingShipment.country = country;
            existingShipment.state = state;
            existingShipment.city = city;
            existingShipment.company = company || existingShipment.company;
            existingShipment.address = address;
            existingShipment.apartment = apartment || existingShipment.apartment;
            existingShipment.name = name;
            existingShipment.zip = zip;
            existingShipment.note = note || existingShipment.note;
            existingShipment.phone = phone;
            existingShipment.email = email;
            existingShipment.isDefault = isDefault !== undefined ? isDefault : existingShipment.isDefault;

            shipment = await existingShipment.save();
        } else {
            // Create new shipment
            const newShipment = new Shipment({
                user: req.user.id,
                country,
                state,
                city,
                company,
                address,
                apartment,
                name,
                zip,
                note,
                phone,
                email,
                isDefault: isDefault !== undefined ? isDefault : true
            });

            shipment = await newShipment.save();
        }

        res.status(201).json({ 
            success: true, 
            shipment,
            message: existingShipment ? 'Shipment details updated successfully' : 'Shipment details created successfully'
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: 'Failed to save shipment details' 
        });
    }
};

/**
 * Get shipment details by ID
 * @route GET /api/shipments/:id
 * @access Private
 */
exports.getShipmentDetailsById = async (req, res) => {
    try {
        const shipment = await Shipment.findById(req.params.id);
        
        if (!shipment) {
            return res.status(404).json({ 
                success: false, 
                message: 'Shipment details not found' 
            });
        }

        // Verify ownership
        if (shipment.user.toString() !== req.user.id && !req.user.isAdmin) {
            return res.status(403).json({ 
                success: false, 
                message: 'Unauthorized access to these shipment details' 
            });
        }

        res.status(200).json({ 
            success: true, 
            shipment 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: 'Failed to retrieve shipment details' 
        });
    }
};

/**
 * Update shipment details by ID
 * @route PUT /api/shipments/:id
 * @access Private
 */
exports.updateShipmentDetails = async (req, res) => {
    try {
        const { 
            country, 
            state, 
            city, 
            company, 
            address, 
            apartment, 
            name, 
            zip, 
            note,
            phone,
            email,
            isDefault
        } = req.body;

        // Verify shipment exists
        const shipment = await Shipment.findById(req.params.id);
        if (!shipment) {
            return res.status(404).json({ 
                success: false, 
                message: 'Shipment details not found' 
            });
        }

        // Verify ownership
        if (shipment.user.toString() !== req.user.id && !req.user.isAdmin) {
            return res.status(403).json({ 
                success: false, 
                message: 'Unauthorized to update these shipment details' 
            });
        }

        // Update fields if provided
        if (country) shipment.country = country;
        if (state) shipment.state = state;
        if (city) shipment.city = city;
        if (company !== undefined) shipment.company = company;
        if (address) shipment.address = address;
        if (apartment !== undefined) shipment.apartment = apartment;
        if (name) shipment.name = name;
        if (zip) shipment.zip = zip;
        if (note !== undefined) shipment.note = note;
        if (phone) shipment.phone = phone;
        if (email) shipment.email = email;
        if (isDefault !== undefined) shipment.isDefault = isDefault;

        const updatedShipment = await shipment.save();

        res.status(200).json({ 
            success: true, 
            shipment: updatedShipment,
            message: 'Shipment details updated successfully'
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: 'Failed to update shipment details' 
        });
    }
};

/**
 * Delete shipment details by ID
 * @route DELETE /api/shipments/:id
 * @access Private
 */
exports.deleteShipmentDetails = async (req, res) => {
    try {
        const shipment = await Shipment.findById(req.params.id);
        
        if (!shipment) {
            return res.status(404).json({ 
                success: false, 
                message: 'Shipment details not found' 
            });
        }

        // Verify ownership
        if (shipment.user.toString() !== req.user.id && !req.user.isAdmin) {
            return res.status(403).json({ 
                success: false, 
                message: 'Unauthorized to delete these shipment details' 
            });
        }

        await Shipment.findByIdAndDelete(req.params.id);

        res.status(200).json({ 
            success: true, 
            message: 'Shipment details deleted successfully' 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: 'Failed to delete shipment details' 
        });
    }
};

/**
 * Calculate shipping costs based on destination and package details
 * @route POST /api/shipments/calculate
 * @access Private
 */
exports.calculateShippingCost = async (req, res) => {
    try {
        const { destination, weight, dimensions, shippingMethod } = req.body;
        
        // Input validation
        if (!destination || !weight || !shippingMethod) {
            return res.status(400).json({
                success: false,
                message: 'Missing required shipping calculation parameters'
            });
        }

        // Simple shipping cost calculation
        let baseCost = 0;
        
        switch(shippingMethod) {
            case 'standard':
                baseCost = 5.99;
                break;
            case 'express':
                baseCost = 12.99;
                break;
            case 'overnight':
                baseCost = 24.99;
                break;
            default:
                baseCost = 5.99;
        }
        
        const weightFactor = Math.ceil(weight);
        let destinationFactor = 1.0;
        if (destination.country !== 'United States') {
            destinationFactor = 2.5;
        }
        
        const shippingCost = (baseCost + (weightFactor - 1) * 1.5) * destinationFactor;
        
        const now = new Date();
        const deliveryEstimates = {
            standard: new Date(now.setDate(now.getDate() + 5)),
            express: new Date(now.setDate(now.getDate() - 3)),
            overnight: new Date(now.setDate(now.getDate() + 1))
        };

        res.status(200).json({
            success: true,
            shippingCost: parseFloat(shippingCost.toFixed(2)),
            estimatedDeliveryDate: deliveryEstimates[shippingMethod],
            shippingMethod
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to calculate shipping cost'
        });
    }
};

/**
 * Get multiple shipment addresses for a user
 * @route GET /api/shipments/addresses
 * @access Private
 */
exports.getUserAddresses = async (req, res) => {
    try {
        const addresses = await Shipment.find({ user: req.user.id })
            .sort({ isDefault: -1, updatedAt: -1 });
        
        res.status(200).json({
            success: true,
            addresses
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve addresses'
        });
    }
};

/**
 * Set a shipment address as default
 * @route PUT /api/shipments/:id/default
 * @access Private
 */
exports.setDefaultAddress = async (req, res) => {
    try {
        const shipment = await Shipment.findById(req.params.id);
        
        if (!shipment) {
            return res.status(404).json({
                success: false,
                message: 'Address not found'
            });
        }

        if (shipment.user.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized to modify this address'
            });
        }

        await Shipment.updateMany(
            { user: req.user.id },
            { $set: { isDefault: false } }
        );

        shipment.isDefault = true;
        await shipment.save();

        res.status(200).json({
            success: true,
            message: 'Default address updated successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to set default address'
        });
    }
};