const express = require("express")
const router = express.Router()
const passport = require("passport")
const User = require("../models/User")
const MechanicProfile = require("../models/MechanicProfile")
const { isAuthenticated } = require("../middleware/auth")
const cloudinary = require("../config/cloudinary")
const authController = require('../controllers/authController');
const otpController = require('../controllers/otpController');

// Login page
router.get("/login", (req, res) => {
  if (req.isAuthenticated()) {
    return redirectBasedOnRole(req, res)
  }
  res.render("auth/login", { title: "Login" })
})

// Register page
router.get("/register", (req, res) => {
  if (req.isAuthenticated()) {
    return redirectBasedOnRole(req, res)
  }
  res.render("auth/register", { title: "Register as User" })
})

// Mechanic register page
router.get("/register-mechanic", (req, res) => {
  if (req.isAuthenticated()) {
    return redirectBasedOnRole(req, res)
  }
  res.render("auth/register-mechanic", { title: "Register as Mechanic" })
})

// Pending approval page
router.get("/pending-approval", (req, res) => {
  res.render("auth/pending-approval", { title: "Pending Approval" })
})

// Login handle
router.post("/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) {
      console.error("Auth error:", err);
      return res.status(500).json({ message: "Server error" });
    }

    if (!user) {
      return res.status(400).json({ message: info?.message || "Invalid credentials" });
    }

    req.logIn(user, (err) => {
      if (err) {
        console.error("Login error:", err);
        return res.status(500).json({ message: "Login failed" });
      }

      // ✅ Send JSON response for frontend
      return res.json({
        message: "Login successful",
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    });
  })(req, res, next);
});

// Redirect based on role
router.get("/redirect", isAuthenticated, (req, res) => {
  redirectBasedOnRole(req, res)
})

// Register user handle (send OTP and redirect to OTP page)
router.post("/register", authController.registerWithOtp);

// Register mechanic handle (send OTP and redirect to OTP page)
router.post("/register-mechanic", authController.registerMechanicWithOtp);

// OTP verification route
router.get("/verify-otp", (req, res) => {
  res.render("auth/verify-otp", { title: "Verify OTP" });
});
router.post("/verify-otp", otpController.verifyOtp);

// Logout
router.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err)
    }
    req.flash("success_msg", "You are logged out")
    res.redirect("/auth/login")
  })
})

// Helper function to redirect based on role
function redirectBasedOnRole(req, res) {
  if (!req.user) {
    return res.redirect("/auth/login")
  }

  switch (req.user.role) {
    case "user":
      return res.redirect("/user/dashboard")
    case "mechanic":
      if (!req.user.isApproved) {
        return res.redirect("/auth/pending-approval")
      }
      return res.redirect("/mechanic/dashboard")
    case "admin":
      return res.redirect("/admin/dashboard")
    default:
      return res.redirect("/")
  }
}

module.exports = router

