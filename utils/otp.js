const nodemailer = require('nodemailer');
const crypto = require('crypto');
require('dotenv').config();

// Generate OTP
function generateOtp() {
    return crypto.randomInt(100000, 999999).toString();  // 6-digit OTP
};

// Set OTP and Expiration (5 minutes)
exports.setOtpForUser = async function (user) {
    const otp = generateOtp();
    user.otpCode = otp;
    user.otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // OTP valid for 5 minutes
    await user.save();
    console.log(otp);
    return otp;
};

/* function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();  // Generates a 6-digit number
} */

exports.sendOtpEmail = async function (user, otp) {
    try {
        console.log('Email user:', process.env.EMAIL_USER);  // Should print your email
        console.log('Email pass:', process.env.EMAIL_PASS);  // Should print the password

        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,  // Use port 465 for SSL
            secure: true,  // Use true since port 465 requires SSL
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        const mailOptions = {
            from: '"Vintiora Admin" <no-reply@wineapp.com>',
            to: user.email,
            subject: 'Your One-Time Password (OTP) for Vintiora',
            html: `
                <div style="font-family: 'Poppins', Arial, sans-serif; color: #333;">
                    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet">
                    <h2 style="color: #63B8AA;">Dear ${user.username || 'Valued Customer'},</h2>
                    <p>Thank you for choosing <strong>Vintiora</strong>. To complete your login or transaction, please use the following One-Time Password (OTP):</p>
        
                    <div style="background-color: #f9f9f9; padding: 10px; border-radius: 5px; margin: 20px 0;">
                        <p style="font-size: 24px; font-weight: bold; text-align: center; color: #000;">${otp}</p>
                    </div>
        
                    <p>This OTP is valid for <strong>5 minutes</strong>. Please enter it in the required field promptly to ensure continued access.</p>
        
                    <p>If you did not request this code, please ignore this email.</p>
        
                    <p>We value your security and privacy.</p>
        
                    <p style="margin-top: 30px;">Best regards,</p>
                    <p><strong>The Vintiora Team</strong></p>
        
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #888;">If you have any questions, please contact our support team at support@vintioraapp.com.</p>
                </div>
            `
        };


        // Send the email
        await transporter.sendMail(mailOptions);
        console.log('OTP email sent successfully.');
    } catch (error) {
        console.error('Error sending OTP email:', error);
        throw new Error('Error sending OTP email. ' + error);
    }
};

