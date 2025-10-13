const User = require('../models/User');
const MechanicProfile = require('../models/MechanicProfile');

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

      // Check if it's a mechanic registration
      if (registrationData.specialization) {
        // Mechanic registration
        const userData = {
          name: registrationData.name,
          email: registrationData.email,
          password: registrationData.password,
          phone: registrationData.phone,
          role: 'mechanic',
          location: {
            coordinates: [registrationData.longitude || 0, registrationData.latitude || 0],
            address: registrationData.address
          },
          isApproved: false
        };
        const newUser = new User(userData);
        await newUser.save();

        const mechanicData = {
          user: newUser._id,
          specialization: registrationData.specialization,
          experience: registrationData.experience,
          hourlyRate: registrationData.hourlyRate,
          documents: registrationData.documents || []
        };
        const newMechanic = new MechanicProfile(mechanicData);
        await newMechanic.save();

        delete req.session.otp;
        delete req.session.registrationData;
        req.flash("success_msg", "Mechanic registration successful! Please wait for approval.");
        return res.redirect('/auth/pending-approval');
      } else {
        // User registration
        const newUser = new User(registrationData);
        await newUser.save();
        delete req.session.otp;
        delete req.session.registrationData;
        req.flash("success_msg", "Registration successful!");
        return res.redirect('/auth/login');
      }
    } catch (error) {
      console.error('Error saving user/mechanic:', error);
      req.flash("error_msg", "Error saving user. Please try again.");
      return res.redirect('/auth/register');
    }
  } else {
    req.flash("error_msg", "Invalid OTP. Please try again.");
    return res.redirect('/auth/verify-otp');
  }
};
