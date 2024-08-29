const Shipment = require('../models/Shipment');

// Get all delivery addresses for a user (protected route)
exports.getShipmentDetails = async (req, res) => {
    try {
        const shipment = await Shipment.findOne({ user: req.user.id });
        res.status(200).json({ success: true, shipment: shipment });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

// Create a new delivery address (protected route)
exports.createShipmentDetails = async (req, res) => {
    try {
        const { country, state, city, company, address, apartment, name, zip, note } = req.body;

        // Check if a shipment already exists for the user
        const existingShipment = await Shipment.findOne({ user: req.user.id });

        if (existingShipment) {
            // Update the existing shipment data
            existingShipment.country = country;
            existingShipment.state = state;
            existingShipment.city = city;
            existingShipment.company = company;
            existingShipment.address = address;
            existingShipment.apartment = apartment;
            existingShipment.name = name;
            existingShipment.zip = zip;
            existingShipment.note = note;

            // Save the updated shipment
            await existingShipment.save();

            return res.status(201).json({ success: true, shipment: existingShipment });
            // return res.status(400).json({ success: false, error: 'Shipment already exists for this user' });
        } else {
            // Create a new shipment if it doesn't exist
            const newAddress = new Shipment({
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
            });

            await newAddress.save();
            res.status(201).json({ success: true, shipment: newAddress });
        }
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

// Get a specific delivery address by ID (protected route)
exports.getShipmentDetailsById = async (req, res) => {
    try {
        const shipment = await Shipment.findById(req.params.id);
        if (!shipment) {
            return res.status(404).json({ success: false, message: 'Address not found' });
        }
        res.status(200).json({ success: true, shipment });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

// Update a specific delivery address (protected route)
exports.updateShipmentDetails = async (req, res) => {
    try {
        const { country, state, city, company, address, apartment, name, zip, note } = req.body;
        const updatedAddress = await Shipment.findByIdAndUpdate(
            req.params.id,
            { country, state, city, company, address, apartment, name, zip, note },
            { new: true }
        );
        if (!updatedAddress) {
            return res.status(404).json({ success: false, message: 'Address not found' });
        }
        res.status(201).json({ success: true, shipment: updatedAddress });
    } catch (error) {
        res.state(404).json({ success: false, error: error.message });
    }
};