const otpService = require('../services/otpService');

exports.register = async (req, res) => {
  // ...existing code to validate input...
  const { email, ...otherData } = req.body;

  if (!email) {
    req.flash('error_msg', 'Email is required for OTP verification.');
    return res.redirect('/auth/register');
  }

  // Generate OTP
  const otp = otpService.generateOtp();
  await otpService.sendOtp(email, otp);

  // Store registration data and OTP in session or temp DB
  req.session.registrationData = { ...otherData, email };
  req.session.otp = otp;

  // Redirect to OTP verification page
  res.redirect('/auth/verify-otp');
};

// Add these exports for compatibility with your routes
exports.registerWithOtp = exports.register;
exports.registerMechanicWithOtp = exports.register;