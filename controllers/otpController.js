const User = require('../models/User');

exports.verifyOtp = async (req, res) => {
  const { otp } = req.body;
  if (otp === req.session.otp) {
    // OTP is correct, create user/mechanic
    try {
      const registrationData = req.session.registrationData;
      if (!registrationData) {
        req.flash("error_msg", "Registration data not found. Please register again.");
        return res.redirect('/auth/register');
      }
      // Create and save user
      const newUser = new User(registrationData);
      await newUser.save();
      delete req.session.otp;
      delete req.session.registrationData;
      req.flash("success_msg", "Registration successful!");
      return res.redirect('/auth/login');
    } catch (error) {
      req.flash("error_msg", "Error saving user. Please try again.");
      return res.redirect('/auth/register');
    }
  } else {
    req.flash("error_msg", "Invalid OTP. Please try again.");
    return res.redirect('/auth/verify-otp');
  }
};
