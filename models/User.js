const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isAdmin: { type: Boolean, default: false },
    profileImage: { type: String },
    favorites: [{
        type: mongoose.Schema.Types.ObjectId, ref: 'Favorite',
    }],
    otpCode: { type: String },            // OTP code field
    otpExpiresAt: { type: Date },          // OTP expiration field
});

// Password hashing middleware
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

// Password comparison method
userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

// OTP comparison method
userSchema.methods.compareOtp = function (candidateOtp) {
    return candidateOtp === this.otpCode && Date.now() < this.otpExpiresAt;
};

const User = mongoose.model('User', userSchema);
module.exports = User;
