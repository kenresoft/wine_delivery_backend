const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    // Authentication and Authorization
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isAdmin: { type: Boolean, default: false },
    otpCode: { type: String },
    otpExpiresAt: { type: Date },
    status: { type: Boolean, default: true },

    // Personal Information
    gender: { type: String },
    phone: { type: String },
    bio: { type: String },
    profileImage: { type: String },

    // Location Information
    location: {
        country: { type: String },
        state: { type: String },
        city: { type: String },
    },

    // E-commerce Related
    orders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
    favorites: [{
        type: mongoose.Schema.Types.ObjectId, ref: 'Favorite',
    }],

    // Device Information
    deviceTokens: { type: [String], default: [] },
});

// Password hashing middleware
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

// Password comparison method
userSchema.methods.comparePassword = async function (userPassword) {
    return bcrypt.compare(userPassword, this.password);
};

// OTP comparison method
userSchema.methods.compareOtp = function (candidateOtp) {
    return candidateOtp === this.otpCode && Date.now() < this.otpExpiresAt;
};

const User = mongoose.model('User', userSchema);
module.exports = User;
