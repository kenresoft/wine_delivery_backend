const Order = require('../models/Order');
const Product = require('../models/Product');
const Promotion = require('../models/Promotion');
const FlashSale = require('../models/FlashSale');
const mongoose = require('mongoose');
const moment = require('moment');

/**
 * Aggregates sales data for configurable time periods
 * Supports granular performance analysis across multiple dimensions
 */
exports.getSalesAnalytics = async (req, res) => {
    try {
        const { timeframe, startDate, endDate } = req.query;
        
        // Construct date filters based on requested timeframe
        let dateFilter = {};
        const currentDate = new Date();
        
        if (startDate && endDate) {
            dateFilter = {
                createdAt: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            };
        } else {
            // Default timeframes
            switch(timeframe) {
                case 'today':
                    dateFilter = {
                        createdAt: {
                            $gte: moment().startOf('day').toDate(),
                            $lte: currentDate
                        }
                    };
                    break;
                case 'week':
                    dateFilter = {
                        createdAt: {
                            $gte: moment().subtract(7, 'days').toDate(),
                            $lte: currentDate
                        }
                    };
                    break;
                case 'month':
                    dateFilter = {
                        createdAt: {
                            $gte: moment().subtract(30, 'days').toDate(),
                            $lte: currentDate
                        }
                    };
                    break;
                case 'quarter':
                    dateFilter = {
                        createdAt: {
                            $gte: moment().subtract(90, 'days').toDate(),
                            $lte: currentDate
                        }
                    };
                    break;
                case 'year':
                    dateFilter = {
                        createdAt: {
                            $gte: moment().subtract(365, 'days').toDate(),
                            $lte: currentDate
                        }
                    };
                    break;
                default:
                    // Default to last 30 days
                    dateFilter = {
                        createdAt: {
                            $gte: moment().subtract(30, 'days').toDate(),
                            $lte: currentDate
                        }
                    };
            }
        }
        
        // Construct pipeline for aggregate operations
        const pipeline = [
            { $match: { ...dateFilter, status: { $ne: 'cancelled' } } },
            {
                $facet: {
                    // Revenue metrics by day
                    revenueByDay: [
                        {
                            $group: {
                                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                                revenue: { $sum: "$totalCost" },
                                orders: { $sum: 1 },
                                itemCount: { $sum: { $size: "$items" } }
                            }
                        },
                        { $sort: { _id: 1 } }
                    ],
                    
                    // Revenue by payment method
                    paymentMethodBreakdown: [
                        {
                            $group: {
                                _id: "$paymentMethod",
                                revenue: { $sum: "$totalCost" },
                                count: { $sum: 1 },
                                averageOrderValue: { $avg: "$totalCost" }
                            }
                        }
                    ],
                    
                    // Order status distribution
                    orderStatusDistribution: [
                        {
                            $group: {
                                _id: "$status",
                                count: { $sum: 1 },
                                revenue: { $sum: "$totalCost" }
                            }
                        }
                    ],
                    
                    // Summary metrics
                    summary: [
                        {
                            $group: {
                                _id: null,
                                totalRevenue: { $sum: "$totalCost" },
                                totalOrders: { $sum: 1 },
                                averageOrderValue: { $avg: "$totalCost" },
                                totalItemsSold: { $sum: { $size: "$items" } }
                            }
                        }
                    ],
                    
                    // Tax and shipping analysis
                    costAnalysis: [
                        {
                            $group: {
                                _id: null,
                                totalTax: { $sum: "$taxAmount" },
                                totalShipping: { $sum: "$shippingCost" },
                                totalDiscount: {
                                    $sum: {
                                        $cond: [
                                            { $ifNull: ["$appliedPromotion.discountAmount", false] },
                                            "$appliedPromotion.discountAmount",
                                            0
                                        ]
                                    }
                                }
                            }
                        }
                    ]
                }
            }
        ];
        
        const analyticsResults = await Order.aggregate(pipeline);
        
        // Calculate growth metrics comparing to previous period
        const previousPeriodFilter = {};
        if (startDate && endDate) {
            const currentStartDate = new Date(startDate);
            const currentEndDate = new Date(endDate);
            const daysDiff = (currentEndDate - currentStartDate) / (1000 * 60 * 60 * 24);
            
            previousPeriodFilter.createdAt = {
                $gte: new Date(currentStartDate.getTime() - (daysDiff * 24 * 60 * 60 * 1000)),
                $lt: currentStartDate
            };
        } else {
            // Calculate previous period based on timeframe
            switch(timeframe) {
                case 'today':
                    previousPeriodFilter.createdAt = {
                        $gte: moment().subtract(1, 'days').startOf('day').toDate(),
                        $lt: moment().startOf('day').toDate()
                    };
                    break;
                case 'week':
                    previousPeriodFilter.createdAt = {
                        $gte: moment().subtract(14, 'days').toDate(),
                        $lt: moment().subtract(7, 'days').toDate()
                    };
                    break;
                case 'month':
                    previousPeriodFilter.createdAt = {
                        $gte: moment().subtract(60, 'days').toDate(),
                        $lt: moment().subtract(30, 'days').toDate()
                    };
                    break;
                default:
                    previousPeriodFilter.createdAt = {
                        $gte: moment().subtract(60, 'days').toDate(),
                        $lt: moment().subtract(30, 'days').toDate()
                    };
            }
        }
        
        // Get previous period metrics
        const previousPeriodMetrics = await Order.aggregate([
            { $match: { ...previousPeriodFilter, status: { $ne: 'cancelled' } } },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: "$totalCost" },
                    totalOrders: { $sum: 1 }
                }
            }
        ]);
        
        // Calculate growth metrics
        let growth = {
            revenue: 0,
            orders: 0
        };
        
        if (analyticsResults[0].summary.length > 0 && previousPeriodMetrics.length > 0) {
            const currentRevenue = analyticsResults[0].summary[0].totalRevenue;
            const previousRevenue = previousPeriodMetrics[0].totalRevenue;
            
            const currentOrders = analyticsResults[0].summary[0].totalOrders;
            const previousOrders = previousPeriodMetrics[0].totalOrders;
            
            growth.revenue = previousRevenue > 0 ? 
                ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;
                
            growth.orders = previousOrders > 0 ? 
                ((currentOrders - previousOrders) / previousOrders) * 100 : 0;
        }
        
        // Combine results
        res.status(200).json({
            success: true,
            data: {
                ...analyticsResults[0],
                growth
            },
            timeframe: timeframe || 'custom',
            period: {
                start: startDate || moment().subtract(30, 'days').format('YYYY-MM-DD'),
                end: endDate || moment().format('YYYY-MM-DD')
            }
        });
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve sales analytics',
            error: error.message
        });
    }
};

/**
 * Evaluates promotion performance metrics
 * Provides conversion rate and revenue impact analysis
 */
exports.getPromotionPerformance = async (req, res) => {
    try {
        const { promotionId, timeframe } = req.query;
        
        // Define date range for the analysis
        let dateFilter = {};
        if (timeframe === 'week') {
            dateFilter.createdAt = { $gte: moment().subtract(7, 'days').toDate() };
        } else if (timeframe === 'month') {
            dateFilter.createdAt = { $gte: moment().subtract(30, 'days').toDate() };
        } else if (timeframe === 'quarter') {
            dateFilter.createdAt = { $gte: moment().subtract(90, 'days').toDate() };
        } else {
            // Default to all-time
            dateFilter = {};
        }
        
        // Construct the match criteria
        let matchCriteria = { ...dateFilter };
        if (promotionId) {
            matchCriteria['appliedPromotion.id'] = mongoose.Types.ObjectId(promotionId);
        } else {
            // Only include orders with some promotion
            matchCriteria['appliedPromotion.id'] = { $exists: true, $ne: null };
        }
        
        // Aggregate promotion usage data
        const promotionPerformance = await Order.aggregate([
            { $match: matchCriteria },
            {
                $group: {
                    _id: "$appliedPromotion.id",
                    code: { $first: "$appliedPromotion.code" },
                    title: { $first: "$appliedPromotion.title" },
                    discountType: { $first: "$appliedPromotion.discountType" },
                    usageCount: { $sum: 1 },
                    totalDiscountAmount: { $sum: "$appliedPromotion.discountAmount" },
                    totalOrderValue: { $sum: "$totalCost" },
                    averageOrderValue: { $avg: "$totalCost" },
                    averageDiscount: { $avg: "$appliedPromotion.discountAmount" }
                }
            },
            {
                $lookup: {
                    from: 'promotions',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'promotionDetails'
                }
            },
            { $unwind: { path: "$promotionDetails", preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: 1,
                    code: 1,
                    title: 1,
                    discountType: 1,
                    usageCount: 1,
                    totalDiscountAmount: 1,
                    totalOrderValue: 1,
                    averageOrderValue: 1,
                    averageDiscount: 1,
                    roi: {
                        $divide: [
                            { $subtract: ["$totalOrderValue", "$totalDiscountAmount"] },
                            "$totalDiscountAmount"
                        ]
                    },
                    conversionRate: {
                        $cond: [
                            { $gt: ["$promotionDetails.totalViewCount", 0] },
                            { $multiply: [{ $divide: ["$usageCount", "$promotionDetails.totalViewCount"] }, 100] },
                            null
                        ]
                    },
                    startDate: "$promotionDetails.startDate",
                    endDate: "$promotionDetails.endDate",
                    isActive: "$promotionDetails.isActive"
                }
            },
            { $sort: { usageCount: -1 } }
        ]);
        
        // If we're looking at a specific promotion, add daily performance
        let dailyPerformance = [];
        if (promotionId) {
            dailyPerformance = await Order.aggregate([
                { 
                    $match: { 
                        ...dateFilter,
                        'appliedPromotion.id': mongoose.Types.ObjectId(promotionId)
                    } 
                },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        usageCount: { $sum: 1 },
                        discountAmount: { $sum: "$appliedPromotion.discountAmount" },
                        orderValue: { $sum: "$totalCost" }
                    }
                },
                { $sort: { _id: 1 } }
            ]);
        }
        
        res.status(200).json({
            success: true,
            data: {
                promotions: promotionPerformance,
                dailyPerformance: dailyPerformance,
                summary: {
                    totalPromotions: promotionPerformance.length,
                    totalUsage: promotionPerformance.reduce((sum, item) => sum + item.usageCount, 0),
                    totalDiscountAmount: promotionPerformance.reduce((sum, item) => sum + item.totalDiscountAmount, 0),
                    totalOrderValue: promotionPerformance.reduce((sum, item) => sum + item.totalOrderValue, 0),
                }
            },
            timeframe: timeframe || 'all-time'
        });
    } catch (error) {
        console.error('Promotion analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve promotion performance data',
            error: error.message
        });
    }
};

/**
 * Analyzes flash sale efficacy and performance metrics
 * Provides inventory depletion rate and revenue acceleration analysis
 */
exports.getFlashSalePerformance = async (req, res) => {
    try {
        const { flashSaleId } = req.query;
        
        // Build match criteria based on whether a specific flash sale is requested
        let matchCriteria = {};
        let flashSaleLookup = {};
        
        if (flashSaleId) {
            // For a specific flash sale
            const flashSale = await FlashSale.findById(flashSaleId);
            if (!flashSale) {
                return res.status(404).json({
                    success: false,
                    message: 'Flash sale not found'
                });
            }
            
            // Get the time period of the flash sale
            matchCriteria = {
                createdAt: {
                    $gte: flashSale.startDate,
                    $lte: flashSale.endDate
                },
                'items.product': { $in: flashSale.products.map(p => p.product) }
            };
            
            flashSaleLookup = {
                $lookup: {
                    from: 'flashsales',
                    let: { productId: '$_id' },
                    pipeline: [
                        { $match: { _id: mongoose.Types.ObjectId(flashSaleId) } },
                        { $unwind: '$products' },
                        {
                            $match: {
                                $expr: {
                                    $eq: ['$products.product', '$$productId']
                                }
                            }
                        }
                    ],
                    as: 'flashSaleData'
                }
            };
        } else {
            // For all flash sales (active in the last 90 days)
            const recentFlashSales = await FlashSale.find({
                endDate: { $gte: moment().subtract(90, 'days').toDate() }
            });
            
            if (recentFlashSales.length === 0) {
                return res.status(200).json({
                    success: true,
                    data: {
                        flashSales: [],
                        products: []
                    },
                    message: 'No recent flash sales found'
                });
            }
            
            // Get all products from all flash sales
            const flashSaleProducts = recentFlashSales.flatMap(sale => 
                sale.products.map(p => ({
                    product: p.product,
                    flashSaleId: sale._id,
                    startDate: sale.startDate,
                    endDate: sale.endDate
                }))
            );
            
            // Create a map of product IDs to their flash sale periods
            const productFlashSalePeriods = {};
            flashSaleProducts.forEach(item => {
                if (!productFlashSalePeriods[item.product]) {
                    productFlashSalePeriods[item.product] = [];
                }
                productFlashSalePeriods[item.product].push({
                    flashSaleId: item.flashSaleId,
                    startDate: item.startDate,
                    endDate: item.endDate
                });
            });
            
            // We'll query orders from the earliest flash sale period
            const earliestDate = recentFlashSales.reduce(
                (earliest, sale) => sale.startDate < earliest ? sale.startDate : earliest,
                recentFlashSales[0].startDate
            );
            
            matchCriteria = {
                createdAt: { $gte: earliestDate },
                'items.product': { 
                    $in: Object.keys(productFlashSalePeriods).map(id => mongoose.Types.ObjectId(id)) 
                }
            };
            
            flashSaleLookup = {
                $lookup: {
                    from: 'flashsales',
                    let: { productId: '$_id', orderDate: new Date() },
                    pipeline: [
                        { 
                            $match: { 
                                endDate: { $gte: moment().subtract(90, 'days').toDate() } 
                            } 
                        },
                        { $unwind: '$products' },
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$products.product', '$$productId'] },
                                        { $lte: ['$startDate', '$$orderDate'] },
                                        { $gte: ['$endDate', '$$orderDate'] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: 'flashSaleData'
                }
            };
        }
        
        // Get orders during flash sale period for the affected products
        const orderItemsPipeline = [
            { $match: matchCriteria },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.product',
                    totalQuantity: { $sum: '$items.quantity' },
                    totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
                    orderCount: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: 'products',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            },
            { $unwind: '$productDetails' },
            flashSaleLookup,
            {
                $project: {
                    productId: '$_id',
                    name: '$productDetails.name',
                    totalQuantity: 1,
                    totalRevenue: 1,
                    orderCount: 1,
                    regularPrice: '$productDetails.price',
                    flashSalePrice: { 
                        $cond: [
                            { $gt: [{ $size: '$flashSaleData' }, 0] },
                            { $arrayElemAt: ['$flashSaleData.products.discountedPrice', 0] },
                            '$productDetails.price'
                        ]
                    },
                    discountPercentage: {
                        $cond: [
                            { $gt: [{ $size: '$flashSaleData' }, 0] },
                            {
                                $multiply: [
                                    {
                                        $divide: [
                                            {
                                                $subtract: [
                                                    '$productDetails.price',
                                                    { $arrayElemAt: ['$flashSaleData.products.discountedPrice', 0] }
                                                ]
                                            },
                                            '$productDetails.price'
                                        ]
                                    },
                                    100
                                ]
                            },
                            0
                        ]
                    },
                    flashSaleData: 1
                }
            },
            { $sort: { totalRevenue: -1 } }
        ];
        
        // Get flash sale statistics
        const flashSaleProducts = await Order.aggregate(orderItemsPipeline);
        
        // Get flash sale summary statistics
        let flashSaleSummary = [];
        if (!flashSaleId) {
            // For all flash sales, get summary per flash sale
            flashSaleSummary = await Order.aggregate([
                { $match: { createdAt: { $gte: moment().subtract(90, 'days').toDate() } } },
                { $unwind: '$items' },
                {
                    $lookup: {
                        from: 'flashsales',
                        let: { 
                            productId: '$items.product', 
                            orderDate: '$createdAt'
                        },
                        pipeline: [
                            {
                                $match: {
                                    endDate: { $gte: moment().subtract(90, 'days').toDate() }
                                }
                            },
                            { $unwind: '$products' },
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ['$products.product', '$$productId'] },
                                            { $lte: ['$startDate', '$$orderDate'] },
                                            { $gte: ['$endDate', '$$orderDate'] }
                                        ]
                                    }
                                }
                            }
                        ],
                        as: 'matchingFlashSale'
                    }
                },
                { $match: { 'matchingFlashSale.0': { $exists: true } } },
                {
                    $group: {
                        _id: { $arrayElemAt: ['$matchingFlashSale._id', 0] },
                        name: { $first: { $arrayElemAt: ['$matchingFlashSale.name', 0] } },
                        startDate: { $first: { $arrayElemAt: ['$matchingFlashSale.startDate', 0] } },
                        endDate: { $first: { $arrayElemAt: ['$matchingFlashSale.endDate', 0] } },
                        totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
                        totalQuantity: { $sum: '$items.quantity' },
                        orderCount: { $sum: 1 },
                        uniqueProducts: { $addToSet: '$items.product' }
                    }
                },
                {
                    $project: {
                        _id: 1,
                        name: 1,
                        startDate: 1,
                        endDate: 1,
                        totalRevenue: 1,
                        totalQuantity: 1,
                        orderCount: 1,
                        productCount: { $size: '$uniqueProducts' },
                        duration: { 
                            $divide: [
                                { $subtract: ['$endDate', '$startDate'] },
                                1000 * 60 * 60 * 24
                            ]
                        },
                        revenuePerDay: {
                            $divide: [
                                '$totalRevenue',
                                {
                                    $max: [
                                        {
                                            $divide: [
                                                { $subtract: ['$endDate', '$startDate'] },
                                                1000 * 60 * 60 * 24
                                            ]
                                        },
                                        1
                                    ]
                                }
                            ]
                        }
                    }
                },
                { $sort: { startDate: -1 } }
            ]);
        } else {
            // For specific flash sale, get summary by day
            const flashSale = await FlashSale.findById(flashSaleId);
            if (flashSale) {
                flashSaleSummary = await Order.aggregate([
                    {
                        $match: {
                            createdAt: {
                                $gte: flashSale.startDate,
                                $lte: flashSale.endDate
                            },
                            'items.product': { 
                                $in: flashSale.products.map(p => p.product) 
                            }
                        }
                    },
                    { $unwind: '$items' },
                    {
                        $match: {
                            'items.product': { 
                                $in: flashSale.products.map(p => p.product) 
                            }
                        }
                    },
                    {
                        $group: {
                            _id: { 
                                date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                                product: '$items.product'
                            },
                            quantity: { $sum: '$items.quantity' },
                            revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
                            orders: { $sum: 1 }
                        }
                    },
                    {
                        $group: {
                            _id: '$_id.date',
                            totalRevenue: { $sum: '$revenue' },
                            totalQuantity: { $sum: '$quantity' },
                            orderCount: { $sum: '$orders' },
                            uniqueProducts: { $addToSet: '$_id.product' }
                        }
                    },
                    {
                        $project: {
                            date: '$_id',
                            _id: 0,
                            totalRevenue: 1,
                            totalQuantity: 1,
                            orderCount: 1,
                            uniqueProductCount: { $size: '$uniqueProducts' }
                        }
                    },
                    { $sort: { date: 1 } }
                ]);
            }
        }
        
        // Calculate flash sale metrics comparing to regular periods
        // For specific flash sale, compare performance to 30 days before
        let performanceComparison = {};
        if (flashSaleId) {
            const flashSale = await FlashSale.findById(flashSaleId);
            if (flashSale) {
                const flashSaleDuration = moment(flashSale.endDate).diff(moment(flashSale.startDate), 'days') + 1;
                const comparePeriodStart = moment(flashSale.startDate).subtract(flashSaleDuration, 'days').toDate();
                const comparePeriodEnd = moment(flashSale.startDate).subtract(1, 'days').toDate();
                
                // Get pre-flash sale performance metrics for comparison
                const preSalePipeline = [
                    {
                        $match: {
                            createdAt: {
                                $gte: comparePeriodStart,
                                $lte: comparePeriodEnd
                            },
                            'items.product': { 
                                $in: flashSale.products.map(p => p.product) 
                            }
                        }
                    },
                    { $unwind: '$items' },
                    {
                        $match: {
                            'items.product': { 
                                $in: flashSale.products.map(p => p.product) 
                            }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
                            totalQuantity: { $sum: '$items.quantity' },
                            orderCount: { $sum: 1 },
                            uniqueProducts: { $addToSet: '$items.product' }
                        }
                    },
                    {
                        $project: {
                            _id: 0,
                            totalRevenue: 1,
                            totalQuantity: 1,
                            orderCount: 1,
                            uniqueProductCount: { $size: '$uniqueProducts' },
                            periodDuration: { $literal: flashSaleDuration }
                        }
                    }
                ];
                
                const flashSalePipeline = [
                    {
                        $match: {
                            createdAt: {
                                $gte: flashSale.startDate,
                                $lte: flashSale.endDate
                            },
                            'items.product': { 
                                $in: flashSale.products.map(p => p.product) 
                            }
                        }
                    },
                    { $unwind: '$items' },
                    {
                        $match: {
                            'items.product': { 
                                $in: flashSale.products.map(p => p.product) 
                            }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
                            totalQuantity: { $sum: '$items.quantity' },
                            orderCount: { $sum: 1 },
                            uniqueProducts: { $addToSet: '$items.product' }
                        }
                    },
                    {
                        $project: {
                            _id: 0,
                            totalRevenue: 1,
                            totalQuantity: 1,
                            orderCount: 1,
                            uniqueProductCount: { $size: '$uniqueProducts' },
                            periodDuration: { $literal: flashSaleDuration }
                        }
                    }
                ];
                
                const [preSaleResults, flashSaleResults] = await Promise.all([
                    Order.aggregate(preSalePipeline),
                    Order.aggregate(flashSalePipeline)
                ]);
                
                if (preSaleResults.length > 0 && flashSaleResults.length > 0) {
                    const preSale = preSaleResults[0];
                    const duringFlashSale = flashSaleResults[0];
                    
                    // Calculate performance metrics
                    performanceComparison = {
                        periods: {
                            flashSale: {
                                startDate: flashSale.startDate,
                                endDate: flashSale.endDate,
                                ...duringFlashSale
                            },
                            preFlashSale: {
                                startDate: comparePeriodStart,
                                endDate: comparePeriodEnd,
                                ...preSale
                            }
                        },
                        revenueGrowth: calculateGrowthPercentage(preSale.totalRevenue, duringFlashSale.totalRevenue),
                        quantityGrowth: calculateGrowthPercentage(preSale.totalQuantity, duringFlashSale.totalQuantity),
                        orderCountGrowth: calculateGrowthPercentage(preSale.orderCount, duringFlashSale.orderCount),
                        revenuePerDay: {
                            flashSale: duringFlashSale.totalRevenue / duringFlashSale.periodDuration,
                            preFlashSale: preSale.totalRevenue / preSale.periodDuration,
                            growthPercentage: calculateGrowthPercentage(
                                preSale.totalRevenue / preSale.periodDuration,
                                duringFlashSale.totalRevenue / duringFlashSale.periodDuration
                            )
                        },
                        quantityPerDay: {
                            flashSale: duringFlashSale.totalQuantity / duringFlashSale.periodDuration,
                            preFlashSale: preSale.totalQuantity / preSale.periodDuration,
                            growthPercentage: calculateGrowthPercentage(
                                preSale.totalQuantity / preSale.periodDuration,
                                duringFlashSale.totalQuantity / duringFlashSale.periodDuration
                            )
                        }
                    };
                }
            }
        }
        
        // Get inventory depletion metrics for products in flash sale
        let inventoryMetrics = [];
        if (flashSaleId) {
            const flashSale = await FlashSale.findById(flashSaleId);
            if (flashSale) {
                const productIds = flashSale.products.map(p => p.product);
                
                // Look up current inventory levels
                const products = await Product.find({
                    _id: { $in: productIds }
                }, 'name stockQuantity initialStock');
                
                // Calculate inventory depletion
                inventoryMetrics = products.map(product => {
                    const flashSaleProduct = flashSaleProducts.find(
                        p => p.productId.toString() === product._id.toString()
                    );
                    
                    return {
                        productId: product._id,
                        name: product.name,
                        initialStock: product.initialStock || 0,
                        currentStock: product.stockQuantity,
                        soldDuringFlashSale: flashSaleProduct ? flashSaleProduct.totalQuantity : 0,
                        depletionRate: product.initialStock ? 
                            ((product.initialStock - product.stockQuantity) / product.initialStock) * 100 : 0,
                        sellThroughRate: flashSaleProduct && product.initialStock ? 
                            (flashSaleProduct.totalQuantity / product.initialStock) * 100 : 0
                    };
                });
            }
        }
        
        // Construct response
        res.status(200).json({
            success: true,
            data: {
                // All flash sales summary or specific flash sale details
                flashSales: !flashSaleId ? flashSaleSummary : (await FlashSale.findById(flashSaleId)),
                // Daily performance for specific flash sale
                dailyPerformance: flashSaleId ? flashSaleSummary : [],
                // Product performance
                products: flashSaleProducts,
                // Inventory metrics
                inventory: inventoryMetrics,
                // Performance comparison
                performanceComparison: performanceComparison,
                // Summary metrics
                summary: {
                    totalFlashSales: !flashSaleId ? flashSaleSummary.length : 1,
                    totalRevenue: !flashSaleId ? 
                        flashSaleSummary.reduce((sum, sale) => sum + sale.totalRevenue, 0) : 
                        flashSaleSummary.reduce((sum, day) => sum + day.totalRevenue, 0),
                    totalProductsSold: !flashSaleId ? 
                        flashSaleSummary.reduce((sum, sale) => sum + sale.totalQuantity, 0) : 
                        flashSaleSummary.reduce((sum, day) => sum + day.totalQuantity, 0),
                    averageRevenuePerSale: !flashSaleId && flashSaleSummary.length > 0 ? 
                        flashSaleSummary.reduce((sum, sale) => sum + sale.totalRevenue, 0) / flashSaleSummary.length : 
                        null
                }
            }
        });
    } catch (error) {
        console.error('Flash sale analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve flash sale performance data',
            error: error.message
        });
    }
};

/**
 * Helper function to calculate growth percentage
 */
function calculateGrowthPercentage(baseValue, newValue) {
    if (!baseValue || baseValue === 0) return null;
    return ((newValue - baseValue) / baseValue) * 100;
}

/**
 * Analyzes product performance across various dimensions
 * Provides insights on sales trends, inventory velocity, and category performance
 */
exports.getProductPerformance = async (req, res) => {
    try {
        const { productId } = req.params;
        const { timeframe, startDate, endDate, category } = req.query;
        
        // Construct date filters based on requested timeframe
        let dateFilter = {};
        const currentDate = new Date();
        
        if (startDate && endDate) {
            dateFilter = {
                createdAt: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            };
        } else {
            // Default timeframes
            switch(timeframe) {
                case 'week':
                    dateFilter = {
                        createdAt: {
                            $gte: moment().subtract(7, 'days').toDate(),
                            $lte: currentDate
                        }
                    };
                    break;
                case 'month':
                    dateFilter = {
                        createdAt: {
                            $gte: moment().subtract(30, 'days').toDate(),
                            $lte: currentDate
                        }
                    };
                    break;
                case 'quarter':
                    dateFilter = {
                        createdAt: {
                            $gte: moment().subtract(90, 'days').toDate(),
                            $lte: currentDate
                        }
                    };
                    break;
                case 'year':
                    dateFilter = {
                        createdAt: {
                            $gte: moment().subtract(365, 'days').toDate(),
                            $lte: currentDate
                        }
                    };
                    break;
                default:
                    // Default to last 30 days
                    dateFilter = {
                        createdAt: {
                            $gte: moment().subtract(30, 'days').toDate(),
                            $lte: currentDate
                        }
                    };
            }
        }
        
        // Construct product filter
        let productFilter = {};
        if (productId) {
            productFilter = { 'items.product': mongoose.Types.ObjectId(productId) };
        } else if (category) {
            // Get all products in the category
            const products = await Product.find({ category: category }, '_id');
            productFilter = { 'items.product': { $in: products.map(p => p._id) } };
        }
        
        // Construct pipeline for aggregate operations
        const pipeline = [
            { $match: { ...dateFilter, ...productFilter, status: { $ne: 'cancelled' } } },
            { $unwind: '$items' },
            {
                $lookup: {
                    from: 'products',
                    localField: 'items.product',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            },
            { $unwind: '$productDetails' },
            {
                $facet: {
                    // Product sales by day
                    salesByDay: [
                        {
                            $group: {
                                _id: {
                                    date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                                    productId: '$items.product'
                                },
                                productName: { $first: '$productDetails.name' },
                                quantity: { $sum: '$items.quantity' },
                                revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
                            }
                        },
                        {
                            $group: {
                                _id: '$_id.date',
                                products: {
                                    $push: {
                                        productId: '$_id.productId',
                                        name: '$productName',
                                        quantity: '$quantity',
                                        revenue: '$revenue'
                                    }
                                },
                                totalRevenue: { $sum: '$revenue' },
                                totalQuantity: { $sum: '$quantity' }
                            }
                        },
                        { $sort: { _id: 1 } }
                    ],
                    
                    // Product performance rankings
                    productRankings: [
                        {
                            $group: {
                                _id: '$items.product',
                                name: { $first: '$productDetails.name' },
                                category: { $first: '$productDetails.category' },
                                price: { $first: '$productDetails.price' },
                                totalQuantity: { $sum: '$items.quantity' },
                                totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
                                orderCount: { $sum: 1 }
                            }
                        },
                        {
                            $project: {
                                _id: 1,
                                name: 1,
                                category: 1,
                                price: 1,
                                totalQuantity: 1,
                                totalRevenue: 1,
                                orderCount: 1,
                                averageOrderValue: { $divide: ['$totalRevenue', '$orderCount'] }
                            }
                        },
                        { $sort: { totalRevenue: -1 } }
                    ],
                    
                    // Category performance
                    categoryPerformance: [
                        {
                            $group: {
                                _id: '$productDetails.category',
                                productCount: { $addToSet: '$items.product' },
                                totalQuantity: { $sum: '$items.quantity' },
                                totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
                                orderCount: { $sum: 1 }
                            }
                        },
                        {
                            $project: {
                                category: '$_id',
                                _id: 0,
                                productCount: { $size: '$productCount' },
                                totalQuantity: 1,
                                totalRevenue: 1,
                                orderCount: 1,
                                averageRevenuePerProduct: { 
                                    $cond: [
                                        { $gt: [{ $size: '$productCount' }, 0] },
                                        { $divide: ['$totalRevenue', { $size: '$productCount' }] },
                                        0
                                    ]
                                }
                            }
                        },
                        { $sort: { totalRevenue: -1 } }
                    ],
                    
                    // Inventory turnover analysis (for specific product only)
                    inventoryAnalysis: productId ? [
                        {
                            $group: {
                                _id: '$items.product',
                                totalQuantitySold: { $sum: '$items.quantity' },
                                name: { $first: '$productDetails.name' },
                                category: { $first: '$productDetails.category' },
                                price: { $first: '$productDetails.price' }
                            }
                        }
                    ] : []
                }
            }
        ];
        
        const analyticsResults = await Order.aggregate(pipeline);
        
        // For specific product, get additional inventory metrics
        let inventoryTurnover = null;
        if (productId && analyticsResults[0].inventoryAnalysis.length > 0) {
            const product = await Product.findById(productId);
            if (product) {
                const quantitySold = analyticsResults[0].inventoryAnalysis[0].totalQuantitySold;
                const currentStock = product.stockQuantity || 0;
                const averageInventory = (product.initialStock + currentStock) / 2;
                
                inventoryTurnover = {
                    productId,
                    name: product.name,
                    initialStock: product.initialStock || 0,
                    currentStock,
                    quantitySold,
                    turnoverRate: averageInventory > 0 ? quantitySold / averageInventory : 0,
                    estimatedDaysOfSupply: quantitySold > 0 ? 
                        (currentStock / (quantitySold / moment(endDate || currentDate).diff(moment(startDate || moment().subtract(30, 'days')), 'days'))) : null
                };
            }
        }
        
        // Calculate growth metrics for product(s)
        let growth = {};
        if (productId) {
            // For specific product, calculate growth compared to previous period
            const previousPeriodFilter = {};
            if (startDate && endDate) {
                const currentStartDate = new Date(startDate);
                const currentEndDate = new Date(endDate);
                const daysDiff = (currentEndDate - currentStartDate) / (1000 * 60 * 60 * 24);
                
                previousPeriodFilter.createdAt = {
                    $gte: new Date(currentStartDate.getTime() - (daysDiff * 24 * 60 * 60 * 1000)),
                    $lt: currentStartDate
                };
            } else {
                // Calculate previous period based on timeframe
                switch(timeframe) {
                    case 'week':
                        previousPeriodFilter.createdAt = {
                            $gte: moment().subtract(14, 'days').toDate(),
                            $lt: moment().subtract(7, 'days').toDate()
                        };
                        break;
                    case 'month':
                        previousPeriodFilter.createdAt = {
                            $gte: moment().subtract(60, 'days').toDate(),
                            $lt: moment().subtract(30, 'days').toDate()
                        };
                        break;
                    default:
                        previousPeriodFilter.createdAt = {
                            $gte: moment().subtract(60, 'days').toDate(),
                            $lt: moment().subtract(30, 'days').toDate()
                        };
                }
            }
            
            // Get previous period metrics
            const previousPeriodPipeline = [
                { 
                    $match: { 
                        ...previousPeriodFilter, 
                        'items.product': mongoose.Types.ObjectId(productId),
                        status: { $ne: 'cancelled' }
                    } 
                },
                { $unwind: '$items' },
                {
                    $match: { 'items.product': mongoose.Types.ObjectId(productId) }
                },
                {
                    $group: {
                        _id: null,
                        totalQuantity: { $sum: '$items.quantity' },
                        totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
                        orderCount: { $sum: 1 }
                    }
                }
            ];
            
            const previousPeriodMetrics = await Order.aggregate(previousPeriodPipeline);
            
            // Extract current period metrics for the product
            const currentProductMetrics = analyticsResults[0].productRankings.find(
                p => p._id.toString() === productId
            );
            
            if (currentProductMetrics && previousPeriodMetrics.length > 0) {
                growth = {
                    quantity: calculateGrowthPercentage(
                        previousPeriodMetrics[0].totalQuantity,
                        currentProductMetrics.totalQuantity
                    ),
                    revenue: calculateGrowthPercentage(
                        previousPeriodMetrics[0].totalRevenue,
                        currentProductMetrics.totalRevenue
                    ),
                    orders: calculateGrowthPercentage(
                        previousPeriodMetrics[0].orderCount,
                        currentProductMetrics.orderCount
                    )
                };
            }
        } else if (category) {
            // For category, calculate growth compared to previous period
            const previousPeriodFilter = {};
            if (startDate && endDate) {
                const currentStartDate = new Date(startDate);
                const currentEndDate = new Date(endDate);
                const daysDiff = (currentEndDate - currentStartDate) / (1000 * 60 * 60 * 24);
                
                previousPeriodFilter.createdAt = {
                    $gte: new Date(currentStartDate.getTime() - (daysDiff * 24 * 60 * 60 * 1000)),
                    $lt: currentStartDate
                };
            } else {
                // Calculate previous period based on timeframe
                switch(timeframe) {
                    case 'week':
                        previousPeriodFilter.createdAt = {
                            $gte: moment().subtract(14, 'days').toDate(),
                            $lt: moment().subtract(7, 'days').toDate()
                        };
                        break;
                    case 'month':
                        previousPeriodFilter.createdAt = {
                            $gte: moment().subtract(60, 'days').toDate(),
                            $lt: moment().subtract(30, 'days').toDate()
                        };
                        break;
                    default:
                        previousPeriodFilter.createdAt = {
                            $gte: moment().subtract(60, 'days').toDate(),
                            $lt: moment().subtract(30, 'days').toDate()
                        };
                }
            }
            
            // Get products in the category
            const products = await Product.find({ category: category }, '_id');
            const productIds = products.map(p => p._id);
            
            // Get previous period metrics for the category
            const previousPeriodPipeline = [
                { 
                    $match: { 
                        ...previousPeriodFilter, 
                        'items.product': { $in: productIds },
                        status: { $ne: 'cancelled' }
                    } 
                },
                { $unwind: '$items' },
                {
                    $match: { 'items.product': { $in: productIds } }
                },
                {
                    $lookup: {
                        from: 'products',
                        localField: 'items.product',
                        foreignField: '_id',
                        as: 'productDetails'
                    }
                },
                { $unwind: '$productDetails' },
                {
                    $match: { 'productDetails.category': category }
                },
                {
                    $group: {
                        _id: null,
                        totalQuantity: { $sum: '$items.quantity' },
                        totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
                        orderCount: { $sum: 1 }
                    }
                }
            ];
            
            const previousPeriodMetrics = await Order.aggregate(previousPeriodPipeline);
            
            // Extract current period metrics for the category
            const currentCategoryMetrics = analyticsResults[0].categoryPerformance.find(
                c => c.category === category
            );
            
            if (currentCategoryMetrics && previousPeriodMetrics.length > 0) {
                growth = {
                    quantity: calculateGrowthPercentage(
                        previousPeriodMetrics[0].totalQuantity,
                        currentCategoryMetrics.totalQuantity
                    ),
                    revenue: calculateGrowthPercentage(
                        previousPeriodMetrics[0].totalRevenue,
                        currentCategoryMetrics.totalRevenue
                    ),
                    orders: calculateGrowthPercentage(
                        previousPeriodMetrics[0].orderCount,
                        currentCategoryMetrics.orderCount
                    )
                };
            }
        }
        
        // Combine results with additional metadata
        res.status(200).json({
            success: true,
            data: {
                ...analyticsResults[0],
                inventoryTurnover,
                growth,
                summary: {
                    totalProducts: analyticsResults[0].productRankings.length,
                    totalCategories: analyticsResults[0].categoryPerformance.length,
                    totalRevenue: analyticsResults[0].productRankings.reduce((sum, p) => sum + p.totalRevenue, 0),
                    totalQuantity: analyticsResults[0].productRankings.reduce((sum, p) => sum + p.totalQuantity, 0)
                }
            },
            timeframe: timeframe || 'custom',
            period: {
                start: startDate || moment().subtract(30, 'days').format('YYYY-MM-DD'),
                end: endDate || moment().format('YYYY-MM-DD')
            },
            filter: productId ? { productId } : (category ? { category } : null)
        });
    } catch (error) {
        console.error('Product analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve product performance data',
            error: error.message
        });
    }
};

/**
 * Generates comprehensive business intelligence dashboard metrics
 * Provides holistic view of business performance across multiple dimensions
 */
exports.getDashboardMetrics = async (req, res) => {
    try {
        // Get current date and time frame references
        const currentDate = new Date();
        const today = moment().startOf('day').toDate();
        const lastWeekStart = moment().subtract(7, 'days').startOf('day').toDate();
        const lastMonthStart = moment().subtract(30, 'days').startOf('day').toDate();
        const thisMonthStart = moment().startOf('month').toDate();
        const thisYearStart = moment().startOf('year').toDate();
        
        // Execute all metrics queries in parallel for optimal performance
        const [
            revenueMetrics,
            orderMetrics,
            productMetrics,
            inventoryAlerts,
            promotionEffectiveness,
            salesVelocity
        ] = await Promise.all([
            // Revenue metrics - multi-period analysis
            Order.aggregate([
                {
                    $facet: {
                        today: [
                            { 
                                $match: { 
                                    createdAt: { $gte: today },
                                    status: { $ne: 'cancelled' }
                                } 
                            },
                            {
                                $group: {
                                    _id: null,
                                    revenue: { $sum: '$totalCost' },
                                    orders: { $sum: 1 },
                                    averageOrderValue: { $avg: '$totalCost' }
                                }
                            }
                        ],
                        thisWeek: [
                            { 
                                $match: { 
                                    createdAt: { $gte: lastWeekStart },
                                    status: { $ne: 'cancelled' }
                                } 
                            },
                            {
                                $group: {
                                    _id: null,
                                    revenue: { $sum: '$totalCost' },
                                    orders: { $sum: 1 }
                                }
                            }
                        ],
                        thisMonth: [
                            { 
                                $match: { 
                                    createdAt: { $gte: thisMonthStart },
                                    status: { $ne: 'cancelled' }
                                } 
                            },
                            {
                                $group: {
                                    _id: null,
                                    revenue: { $sum: '$totalCost' },
                                    orders: { $sum: 1 }
                                }
                            }
                        ],
                        lastThirtyDays: [
                            { 
                                $match: { 
                                    createdAt: { $gte: lastMonthStart },
                                    status: { $ne: 'cancelled' }
                                } 
                            },
                            {
                                $group: {
                                    _id: null,
                                    revenue: { $sum: '$totalCost' },
                                    orders: { $sum: 1 }
                                }
                            }
                        ],
                        thisYear: [
                            { 
                                $match: { 
                                    createdAt: { $gte: thisYearStart },
                                    status: { $ne: 'cancelled' }
                                } 
                            },
                            {
                                $group: {
                                    _id: null,
                                    revenue: { $sum: '$totalCost' },
                                    orders: { $sum: 1 }
                                }
                            }
                        ],
                        // Daily trend for the last 30 days
                        revenueByDay: [
                            { 
                                $match: { 
                                    createdAt: { $gte: lastMonthStart },
                                    status: { $ne: 'cancelled' }
                                } 
                            },
                            {
                                $group: {
                                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                                    revenue: { $sum: '$totalCost' },
                                    orders: { $sum: 1 }
                                }
                            },
                            { $sort: { _id: 1 } }
                        ]
                    }
                }
            ]),
            
            // Order fulfillment metrics
            Order.aggregate([
                { $match: { createdAt: { $gte: lastMonthStart } } },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                        value: { $sum: '$totalCost' }
                    }
                },
                {
                    $project: {
                        status: '$_id',
                        _id: 0,
                        count: 1,
                        value: 1
                    }
                }
            ]),
            
            // Product performance metrics
            Order.aggregate([
                { 
                    $match: { 
                        createdAt: { $gte: lastMonthStart },
                        status: { $ne: 'cancelled' }
                    } 
                },
                { $unwind: '$items' },
                {
                    $group: {
                        _id: '$items.product',
                        totalQuantity: { $sum: '$items.quantity' },
                        totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
                    }
                },
                { $sort: { totalRevenue: -1 } },
                { $limit: 10 },
                {
                    $lookup: {
                        from: 'products',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'productDetails'
                    }
                },
                { $unwind: '$productDetails' },
                {
                    $project: {
                        _id: 1,
                        name: '$productDetails.name',
                        category: '$productDetails.category',
                        totalQuantity: 1,
                        totalRevenue: 1
                    }
                }
            ]),
            
            // Inventory alerts - low stock and velocity monitoring
            Product.aggregate([
                {
                    $project: {
                        _id: 1,
                        name: 1,
                        stockQuantity: 1,
                        price: 1,
                        category: 1,
                        reorderThreshold: 1,
                        lowStock: { $lte: ['$stockQuantity', '$reorderThreshold'] },
                        outOfStock: { $eq: ['$stockQuantity', 0] }
                    }
                },
                {
                    $match: {
                        $or: [
                            { lowStock: true },
                            { outOfStock: true }
                        ]
                    }
                },
                { $sort: { stockQuantity: 1 } }
            ]),
            
            // Promotion effectiveness metrics
            Order.aggregate([
                { 
                    $match: { 
                        createdAt: { $gte: lastMonthStart },
                        status: { $ne: 'cancelled' },
                        'appliedPromotion.id': { $exists: true, $ne: null }
                    } 
                },
                {
                    $group: {
                        _id: '$appliedPromotion.code',
                        promotionId: { $first: '$appliedPromotion.id' },
                        title: { $first: '$appliedPromotion.title' },
                        usageCount: { $sum: 1 },
                        totalDiscountAmount: { $sum: '$appliedPromotion.discountAmount' },
                        totalOrderValue: { $sum: '$totalCost' }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        code: '$_id',
                        promotionId: 1,
                        title: 1,
                        usageCount: 1,
                        totalDiscountAmount: 1,
                        totalOrderValue: 1,
                        effectiveness: {
                            $divide: [
                                '$totalOrderValue',
                                { $max: ['$totalDiscountAmount', 1] }
                            ]
                        }
                    }
                },
                { $sort: { effectiveness: -1 } },
                { $limit: 5 }
            ]),
            
            // Sales velocity metrics
            Order.aggregate([
                { 
                    $match: { 
                        createdAt: { $gte: lastMonthStart },
                        status: { $ne: 'cancelled' }
                    } 
                },
                { $unwind: '$items' },
                {
                    $group: {
                        _id: { 
                            product: '$items.product',
                            day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }
                        },
                        quantity: { $sum: '$items.quantity' }
                    }
                },
                {
                    $group: {
                        _id: '$_id.product',
                        totalDays: { $sum: 1 },
                        totalQuantity: { $sum: '$quantity' }
                    }
                },
                {
                    $lookup: {
                        from: 'products',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'productDetails'
                    }
                },
                { $unwind: '$productDetails' },
                {
                    $project: {
                        _id: 1,
                        name: '$productDetails.name',
                        category: '$productDetails.category',
                        totalQuantity: 1,
                        dailyVelocity: { $divide: ['$totalQuantity', { $max: ['$totalDays', 1] }] },
                        stockLevel: '$productDetails.stockQuantity',
                        daysOfSupply: {
                            $cond: [
                                { $gt: ['$totalQuantity', 0] },
                                {
                                    $divide: [
                                        { $multiply: ['$productDetails.stockQuantity', '$totalDays'] },
                                        '$totalQuantity'
                                    ]
                                },
                                null
                            ]
                        }
                    }
                },
                { $match: { daysOfSupply: { $ne: null } } },
                { $sort: { dailyVelocity: -1 } },
                { $limit: 10 }
            ])
        ]);
        
        // Process revenue metrics
        const revenueData = {
            today: revenueMetrics[0].today.length > 0 ? revenueMetrics[0].today[0] : { revenue: 0, orders: 0, averageOrderValue: 0 },
            thisWeek: revenueMetrics[0].thisWeek.length > 0 ? revenueMetrics[0].thisWeek[0] : { revenue: 0, orders: 0 },
            thisMonth: revenueMetrics[0].thisMonth.length > 0 ? revenueMetrics[0].thisMonth[0] : { revenue: 0, orders: 0 },
            lastThirtyDays: revenueMetrics[0].lastThirtyDays.length > 0 ? revenueMetrics[0].lastThirtyDays[0] : { revenue: 0, orders: 0 },
            thisYear: revenueMetrics[0].thisYear.length > 0 ? revenueMetrics[0].thisYear[0] : { revenue: 0, orders: 0 },
            dailyTrend: revenueMetrics[0].revenueByDay
        };
        
        // Calculate revenue trends
        const calculateDailyAverage = (data, days) => {
            return data && data.revenue ? data.revenue / days : 0;
        };
        
        const revenueAnalysis = {
            dailyAverage: {
                thisWeek: calculateDailyAverage(revenueData.thisWeek, 7),
                thisMonth: calculateDailyAverage(revenueData.thisMonth, moment().date()),
                lastThirtyDays: calculateDailyAverage(revenueData.lastThirtyDays, 30)
            },
            projections: {
                thisMonth: calculateDailyAverage(revenueData.thisMonth, moment().date()) * 
                          moment().daysInMonth(),
                thisYear: calculateDailyAverage(revenueData.thisYear, 
                          moment().dayOfYear()) * 365
            }
        };
        
        // Build comprehensive dashboard response
        res.status(200).json({
            success: true,
            data: {
                revenue: {
                    metrics: revenueData,
                    analysis: revenueAnalysis,
                    trend: revenueData.dailyTrend
                },
                orders: {
                    status: orderMetrics,
                    summary: {
                        total: orderMetrics.reduce((sum, status) => sum + status.count, 0),
                        totalValue: orderMetrics.reduce((sum, status) => sum + status.value, 0),
                        // Calculate fulfillment rates
                        fulfillmentRate: ((orderMetrics.find(s => s.status === 'delivered')?.count || 0) / 
                                        (orderMetrics.reduce((sum, status) => 
                                            status.status !== 'cancelled' ? sum + status.count : sum, 0) || 1)) * 100,
                        cancellationRate: ((orderMetrics.find(s => s.status === 'cancelled')?.count || 0) / 
                                         (orderMetrics.reduce((sum, status) => sum + status.count, 0) || 1)) * 100
                    }
                },
                products: {
                    topPerformers: productMetrics,
                    inventoryAlerts: {
                        items: inventoryAlerts,
                        summary: {
                            lowStock: inventoryAlerts.filter(p => p.lowStock && !p.outOfStock).length,
                            outOfStock: inventoryAlerts.filter(p => p.outOfStock).length,
                            totalAlerts: inventoryAlerts.length
                        }
                    },
                    salesVelocity: salesVelocity
                },
                promotions: {
                    topPerformers: promotionEffectiveness,
                    summary: {
                        totalActivePromotions: await Promotion.countDocuments({ isActive: true }),
                        totalUsage: promotionEffectiveness.reduce((sum, promo) => sum + promo.usageCount, 0),
                        totalDiscountAmount: promotionEffectiveness.reduce((sum, promo) => sum + promo.totalDiscountAmount, 0)
                    }
                }
            },
            timestamp: currentDate,
            refreshInterval: 3600 // Cache refresh interval in seconds
        });
    } catch (error) {
        console.error('Dashboard metrics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve dashboard metrics',
            error: error.message
        });
    }
};

/**
 * Provides customer behavioral analytics and cohort analysis
 * Enables customer segmentation and retention strategy development
 */
/* exports.getCustomerAnalytics = async (req, res) => {
    try {
        const { timeframe, segment } = req.query;

        // Define date ranges based on requested timeframe
        let dateFilter = {};
        const currentDate = new Date();
        
        switch(timeframe) {
            case 'month':
                dateFilter = {
                    createdAt: {
                        $gte: moment().subtract(30, 'days').toDate(),
                        $lte: currentDate
                    }
                };
                break;
            case 'quarter':
                dateFilter = {
                    createdAt: {
                        $gte: moment().subtract(90, 'days').toDate(),
                        $lte: currentDate
                    }
                };
                break;
            case 'year':
                dateFilter = {
                    createdAt: {
                        $gte: moment().subtract(365, 'days').toDate(),
                        $lte: currentDate
                    }
                };
                break;
            default:
                // Default to last 90 days
                dateFilter = {
                    createdAt: {
                        $gte: moment().subtract(90, 'days').toDate(),
                        $lte: currentDate
                    }
                };
        }

        // Add segment filter if provided
        let segmentFilter = {};
        if (segment) {
            switch (segment) {
                case 'new':
                    // First-time customers
                    segmentFilter = { orderCount: 1 };
                    break;
                case 'returning':
                    // Customers with multiple orders
                    segmentFilter = { orderCount: { $gt: 1 } };
                    break;
                case 'high_value':
                    // Customers with high lifetime value
                    segmentFilter = { lifetimeValue: { $gt: 500 } };
                    break;
            }
        }

        // Execute customer analytics pipeline
        const customerAnalytics = await Order.aggregate([
            { $match: { ...dateFilter } },
            {
                $group: {
                    _id: '$customer',
                    orderCount: { $sum: 1 },
                    totalSpent: { $sum: '$totalCost' },
                    averageOrderValue: { $avg: '$totalCost' },
                    firstPurchase: { $min: '$createdAt' },
                    lastPurchase: { $max: '$createdAt' },
                    productsPurchased: { $addToSet: '$items.product' },
                    categoriesPurchased: { $addToSet: '$items.category' }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'customerDetails'
                }
            },
            { $unwind: { path: '$customerDetails', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: 1,
                    name: {
                        $concat: [
                            { $ifNull: ['$customerDetails.firstName', ''] }, ' ',
                            { $ifNull: ['$customerDetails.lastName', ''] }
                        ]
                    },
                    email: '$customerDetails.email',
                    orderCount: 1,
                    totalSpent: 1,
                    averageOrderValue: 1,
                    firstPurchase: 1,
                    lastPurchase: 1,
                    daysSinceLastPurchase: {
                        $divide: [
                            { $subtract: [new Date(), '$lastPurchase'] },
                            1000 * 60 * 60 * 24 // Convert ms to days
                        ]
                    },
                    customerLifetime: {
                        $divide: [
                            { $subtract: ['$lastPurchase', '$firstPurchase'] },
                            1000 * 60 * 60 * 24 // Convert ms to days
                        ]
                    },
                    uniqueProductCount: { $size: { $reduce: { input: '$productsPurchased', initialValue: [], in: { $concatArrays: ['$$value', '$$this'] } } } },
                    uniqueCategoryCount: { $size: { $reduce: { input: '$categoriesPurchased', initialValue: [], in: { $concatArrays: ['$$value', '$$this'] } } } },
                    purchaseFrequency: {
                        $cond: [
                            { $eq: ['$orderCount', 1] },
                            null,
                            {
                                $divide: [
                                    { $subtract: ['$lastPurchase', '$firstPurchase'] },
                                    { $multiply: [1000 * 60 * 60 * 24, { $subtract: ['$orderCount', 1] }] }
                                ]
                            }
                        ]
                    }
                }
            },
            {
                $addFields: {
                    lifetimeValue: '$totalSpent',
                    segment: {
                        $switch: {
                            branches: [
                                { case: { $eq: ['$orderCount', 1] }, then: 'new' },
                                { case: { $gt: ['$daysSinceLastPurchase', 90] }, then: 'at_risk' },
                                { case: { $gt: ['$totalSpent', 500] }, then: 'high_value' },
                                { case: { $gt: ['$averageOrderValue', 100] }, then: 'big_spender' }
                            ],
                            default: 'regular'
                        }
                    }
                }
            },
            { $match: { ...segmentFilter } },
            { $sort: { totalSpent: -1 } }
        ]);

        // Generate cohort analysis based on first purchase month
        const cohortAnalysis = await Order.aggregate([
            { $match: { ...dateFilter } },
            {
                $group: {
                    _id: {
                        customer: '$customer',
                        cohort: { $dateToString: { format: '%Y-%m', date: { $arrayElemAt: ['$firstPurchaseDate', 0] } } }
                    },
                    firstPurchase: { $min: '$createdAt' },
                    orders: { $push: { date: '$createdAt', value: '$totalCost' } }
                }
            },
            {
                $project: {
                    _id: 0,
                    customer: '$_id.customer',
                    cohort: {
                        $dateToString: { format: '%Y-%m', date: '$firstPurchase' }
                    },
                    orders: 1
                }
            },
            {
                $unwind: '$orders'
            },
            {
                $project: {
                    customer: 1,
                    cohort: 1,
                    orderDate: '$orders.date',
                    orderValue: '$orders.value',
                    monthIndex: {
                        $divide: [
                            { $subtract: [
                                { $dateFromString: { dateString: { $dateToString: { format: '%Y-%m-01', date: '$orders.date' } } } },
                                { $dateFromString: { dateString: { $concat: ['$cohort', '-01'] } } }
                            ]},
                            1000 * 60 * 60 * 24 * 30 // Approximate months in ms
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: {
                        cohort: '$cohort',
                        monthIndex: { $floor: '$monthIndex' }
                    },
                    customerCount: { $addToSet: '$customer' },
                    totalRevenue: { $sum: '$orderValue' }
                }
            },
            {
                $project: {
                    _id: 0,
                    cohort: '$_id.cohort',
                    monthIndex: '$_id.monthIndex',
                    customerCount: { $size: '$customerCount' },
                    totalRevenue: 1,
                    averageRevenue: { $divide: ['$totalRevenue', { $size: '$customerCount' }] }
                }
            },
            { $sort: { cohort: 1, monthIndex: 1 } }
        ]);

        // Format cohort data into a matrix
        const cohorts = {};
        cohortAnalysis.forEach(item => {
            if (!cohorts[item.cohort]) {
                cohorts[item.cohort] = {
                    initialSize: 0,
                    months: {}
                };
            }
            
            // Track initial cohort size (month 0)
            if (item.monthIndex === 0) {
                cohorts[item.cohort].initialSize = item.customerCount;
            }
            
            cohorts[item.cohort].months[item.monthIndex] = {
                count: item.customerCount,
                retentionRate: item.monthIndex === 0 ? 100 : 
                    (item.customerCount
 */