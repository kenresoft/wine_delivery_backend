const FlashSale = require('../models/FlashSale');
const Product = require('../models/Product');

// Create a new flash sale
exports.createFlashSale = async (req, res) => {
    try {
        // Extract flashSaleProducts directly from request body
        const { flashSaleProducts, ...rest } = req.body;

        // Validate required fields
        if (!flashSaleProducts || flashSaleProducts.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one product is required for a flash sale'
            });
        }

        // Validate specialPrice exists for all products
        const missingSpecialPrice = flashSaleProducts.some(p => p.specialPrice === undefined);
        if (missingSpecialPrice) {
            return res.status(400).json({
                success: false,
                message: 'All products must have a specialPrice specified'
            });
        }

        // Get product IDs from request
        const productIds = flashSaleProducts.map(p => p.product);
        const existingProducts = await Product.countDocuments({
            _id: { $in: productIds }
        });

        if (existingProducts !== productIds.length) {
            return res.status(400).json({
                success: false,
                message: 'One or more products do not exist'
            });
        }

        // Check 2: Verify products aren't in other flash sales
        const conflictedProducts = await Product.find({
            _id: { $in: productIds },
            'currentFlashSale.flashSale': { $exists: true }
        }).select('_id');

        if (conflictedProducts.length > 0) {
            const conflictedIds = conflictedProducts.map(p => p._id.toString());
            return res.status(409).json({
                success: false,
                message: 'Products already in other flash sales',
                conflictedProducts: conflictedIds
            });
        }

        // Create the flash sale
        const flashSale = await FlashSale.create({
            ...rest,
            flashSaleProducts
        });

        // Update products with flash sale reference
        const updateOperations = flashSaleProducts.map(item => ({
            updateOne: {
                filter: { _id: item.product },
                update: {
                    $set: {
                        currentFlashSale: {
                            flashSale: flashSale._id,
                            specialPrice: item.specialPrice,
                            startDate: flashSale.startDate,
                            endDate: flashSale.endDate
                        }
                    }
                }
            }
        }));

        await Product.bulkWrite(updateOperations);

        res.status(201).json({
            success: true,
            flashSale
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// Get all flash sales with filtering
exports.getAllFlashSales = async (req, res) => {
    try {
        const { active, upcoming, past } = req.query;
        const now = new Date();

        let filter = {};

        if (active === 'true') {
            // Currently active flash sales
            filter = {
                startDate: { $lte: now },
                endDate: { $gte: now },
                isActive: true
            };
        } else if (upcoming === 'true') {
            // Upcoming flash sales
            filter = {
                startDate: { $gt: now },
                isActive: true
            };
        } else if (past === 'true') {
            // Past flash sales
            filter = {
                endDate: { $lt: now }
            };
        }

        const flashSales = await FlashSale.find(filter)
            .sort({ startDate: 1 })
            .populate({
                path: 'flashSaleProducts.product',
                select: 'name images defaultPrice brand description'
            });

        // Calculate time remaining for active sales
        const flashSalesWithMeta = flashSales.map(sale => {
            const data = sale.toObject();

            if (now >= sale.startDate && now <= sale.endDate) {
                data.timeRemaining = sale.getTimeRemaining();
                data.timeRemainingFormatted = formatTimeRemaining(data.timeRemaining);
                data.status = 'active';
            } else if (now < sale.startDate) {
                data.status = 'upcoming';
            } else {
                data.status = 'ended';
            }

            return data;
        });

        res.status(200).json({
            success: true,
            count: flashSalesWithMeta.length,
            flashSales: flashSalesWithMeta
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Get a specific flash sale
exports.getFlashSaleById = async (req, res) => {
    try {
        const flashSale = await FlashSale.findById(req.params.id)
            .populate({
                path: 'flashSaleProducts.product',
                select: 'name image images defaultPrice brand description category',
                populate: { // Nested populate for category
                    path: 'category',
                    select: 'name' // Select only the category name
                }
            });

        if (!flashSale) {
            return res.status(404).json({
                success: false,
                message: 'Flash sale not found'
            });
        }

        // Add metadata for client-side handling
        const now = new Date();
        const result = flashSale.toObject();

        if (now >= flashSale.startDate && now <= flashSale.endDate) {
            result.timeRemaining = flashSale.getTimeRemaining();
            result.timeRemainingFormatted = formatTimeRemaining(result.timeRemaining);
            result.status = 'active';
        } else if (now < flashSale.startDate) {
            result.status = 'upcoming';
            result.startsIn = flashSale.startDate.getTime() - now.getTime();
            result.startsInFormatted = formatTimeRemaining(result.startsIn);
        } else {
            result.status = 'ended';
        }

        res.status(200).json({
            success: true,
            flashSale: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Update flash sale
exports.updateFlashSale = async (req, res) => {
    try {
        const { flashSaleProducts, ...rest } = req.body;
        const flashSaleId = req.params.id;

        // Get existing flash sale
        const existingFlashSale = await FlashSale.findById(flashSaleId);
        if (!existingFlashSale) {
            return res.status(404).json({
                success: false,
                message: 'Flash sale not found'
            });
        }

        // Remove existing product associations if products array is provided
        if (flashSaleProducts) {
            // Validate special prices
            const missingSpecialPrice = flashSaleProducts.some(p => p.specialPrice === undefined);
            if (missingSpecialPrice) {
                return res.status(400).json({
                    success: false,
                    message: 'All products must have a specialPrice specified'
                });
            }

            const newProductIds = flashSaleProducts.map(p => p.product);
            const existingProductIds = existingFlashSale.flashSaleProducts.map(p => p.product.toString());

            // Check for new product conflicts
            const newProducts = newProductIds.filter(id => !existingProductIds.includes(id));
            if (newProducts.length > 0) {
                const conflictedProducts = await Product.find({
                    _id: { $in: newProducts },
                    'currentFlashSale.flashSale': { $ne: flashSaleId }
                }).select('_id');

                if (conflictedProducts.length > 0) {
                    return res.status(409).json({
                        success: false,
                        message: 'Some products are in other flash sales',
                        conflictedProducts: conflictedProducts.map(p => p._id)
                    });
                }
            }

            // Remove products being removed from the flash sale
            const removedProducts = existingProductIds.filter(id => !newProductIds.includes(id));
            if (removedProducts.length > 0) {
                await Product.updateMany(
                    { _id: { $in: removedProducts } },
                    { $unset: { currentFlashSale: 1 } }
                );
            }

            // Update the products array
            rest.flashSaleProducts = flashSaleProducts;
        }

        // Update flash sale
        const updatedFlashSale = await FlashSale.findByIdAndUpdate(
            flashSaleId,
            rest,
            { new: true, runValidators: true }
        );

        // Update product references if products were changed
        if (flashSaleProducts) {
            const updateOperations = flashSaleProducts.map(item => ({
                updateOne: {
                    filter: { _id: item.product },
                    update: {
                        $set: {
                            currentFlashSale: {
                                flashSale: flashSaleId,
                                specialPrice: item.specialPrice,
                                startDate: updatedFlashSale.startDate,
                                endDate: updatedFlashSale.endDate
                            }
                        }
                    }
                }
            }));

            await Product.bulkWrite(updateOperations);
        }

        res.status(200).json({
            success: true,
            flashSale: updatedFlashSale
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

// Delete flash sale
exports.deleteFlashSale = async (req, res) => {
    try {
        const flashSale = await FlashSale.findById(req.params.id);

        if (!flashSale) {
            return res.status(404).json({
                success: false,
                message: 'Flash sale not found'
            });
        }

        // Remove flash sale references from associated products
        const productIds = flashSale.flashSaleProducts.map(p => p.product);

        const removePromises = productIds.map(productId => {
            return Product.findByIdAndUpdate(
                productId,
                { $unset: { currentFlashSale: 1 } }
            );
        });

        await Promise.all(removePromises);

        // Delete the flash sale from the database
        await FlashSale.findByIdAndDelete(req.params.id);

        res.status(200).json({
            success: true,
            message: 'Flash sale deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Get currently active flash sales
exports.getActiveFlashSales = async (req, res) => {
    try {
        const now = new Date();

        const activeFlashSales = await FlashSale.find({
            startDate: { $lte: now },
            endDate: { $gte: now },
            isActive: true
        }).populate({
            path: 'flashSaleProducts.product',
            select: 'name image images defaultPrice brand category description',
            populate: { // Nested populate for category
                path: 'category',
                select: 'name' // Select only the category name
            }
        });

        // Add time remaining information
        const activeFlashSalesWithMeta = activeFlashSales.map(sale => {
            const data = sale.toObject();
            data.timeRemaining = sale.getTimeRemaining();
            data.timeRemainingFormatted = formatTimeRemaining(data.timeRemaining);
            return data;
        });

        res.status(200).json({
            success: true,
            count: activeFlashSalesWithMeta.length,
            flashSales: activeFlashSalesWithMeta
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Get products in active flash sales
exports.getFlashSaleProducts = async (req, res) => {
    try {
        const now = new Date();

        const products = await Product.find({
            'currentFlashSale.flashSale': { $exists: true },
            'currentFlashSale.startDate': { $lte: now },
            'currentFlashSale.endDate': { $gte: now },
            deleted: false
        })
            .populate('category', 'name')
            /* .populate({
                path: 'currentFlashSale.flashSale',
                select: 'title discountPercentage'
            }) */
            .select('name image images brand defaultPrice currentFlashSale category');

        // console.log(products);

        // Add calculated fields
        const enhancedProducts = products.map(product => {
            const data = product.toObject();
            const originalPrice = product.defaultPrice;
            const flashSalePrice = product.currentFlashSale.specialPrice;

            // data.originalPrice = originalPrice;
            // data.flashSalePrice = flashSalePrice;
            data.discountPercentage = Math.round((1 - (flashSalePrice / originalPrice)) * 100);
            data.timeRemaining = product.currentFlashSale.endDate.getTime() - now.getTime();
            data.timeRemainingFormatted = formatTimeRemaining(data.timeRemaining);

            return data;
        });

        res.status(200).json({
            success: true,
            count: enhancedProducts.length,
            flashSaleProducts: enhancedProducts
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Utility function to format time remaining
function formatTimeRemaining(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    return {
        hours,
        minutes,
        seconds: remainingSeconds,
        formatted: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
    };
}