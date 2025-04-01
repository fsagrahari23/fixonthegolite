const express = require("express")
const router = express.Router()
const passport = require("passport")
const User = require("../models/User")
const MechanicProfile = require("../models/MechanicProfile")
const { isAuthenticated } = require("../middleware/auth")
const cloudinary = require("../config/cloudinary")

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
  passport.authenticate("local", {
    successRedirect: "/auth/redirect",
    failureRedirect: "/auth/login",
    failureFlash: true,
  })(req, res, next)
})

// Redirect based on role
router.get("/redirect", isAuthenticated, (req, res) => {
  redirectBasedOnRole(req, res)
})

// Register user handle
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, confirmPassword, phone, address, latitude, longitude } = req.body

    // Validation
    const errors = []

    if (!name || !email || !password || !confirmPassword || !phone || !address) {
      errors.push({ msg: "Please fill in all fields" })
    }

    if (password !== confirmPassword) {
      errors.push({ msg: "Passwords do not match" })
    }

    if (password.length < 6) {
      errors.push({ msg: "Password should be at least 6 characters" })
    }

    if (errors.length > 0) {
      return res.render("auth/register", {
        title: "Register as User",
        errors,
        name,
        email,
        phone,
        address,
      })
    }

    // Check if user exists
    const existingUser = await User.findOne({ email })

    if (existingUser) {
      errors.push({ msg: "Email is already registered" })
      return res.render("auth/register", {
        title: "Register as User",
        errors,
        name,
        email,
        phone,
        address,
      })
    }

    // Create new user
    const newUser = new User({
      name,
      email,
      password,
      phone,
      address,
      role: "user",
      location: {
        type: "Point",
        coordinates: [Number.parseFloat(longitude) || 0, Number.parseFloat(latitude) || 0],
      },
    })

    await newUser.save()

    req.flash("success_msg", "You are now registered and can log in")
    res.redirect("/auth/login")
  } catch (error) {
    console.error("Registration error:", error)
    req.flash("error_msg", "An error occurred during registration")
    res.redirect("/auth/register")
  }
})

// Register mechanic handle
router.post("/register-mechanic", async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      confirmPassword,
      phone,
      address,
      latitude,
      longitude,
      specialization,
      experience,
      hourlyRate,
    } = req.body

    // Validation
    const errors = []

    if (
      !name ||
      !email ||
      !password ||
      !confirmPassword ||
      !phone ||
      !address ||
      !specialization ||
      !experience ||
      !hourlyRate
    ) {
      errors.push({ msg: "Please fill in all fields" })
    }

    if (password !== confirmPassword) {
      errors.push({ msg: "Passwords do not match" })
    }

    if (password.length < 6) {
      errors.push({ msg: "Password should be at least 6 characters" })
    }

    if (!req.files || !req.files.documents) {
      errors.push({ msg: "Please upload your certification documents" })
    }

    if (errors.length > 0) {
      return res.render("auth/register-mechanic", {
        title: "Register as Mechanic",
        errors,
        name,
        email,
        phone,
        address,
        specialization,
        experience,
        hourlyRate,
      })
    }

    // Check if user exists
    const existingUser = await User.findOne({ email })

    if (existingUser) {
      errors.push({ msg: "Email is already registered" })
      return res.render("auth/register-mechanic", {
        title: "Register as Mechanic",
        errors,
        name,
        email,
        phone,
        address,
        specialization,
        experience,
        hourlyRate,
      })
    }

    // Upload documents to cloudinary
    const documents = []
    if (req.files.documents.length) {
      // Multiple files
      for (const file of req.files.documents) {
        const result = await cloudinary.uploader.upload(file.tempFilePath)
        documents.push(result.secure_url)
      }
    } else {
      // Single file
      const result = await cloudinary.uploader.upload(req.files.documents.tempFilePath)
      documents.push(result.secure_url)
    }

    // Create new user
    const newUser = new User({
      name,
      email,
      password,
      phone,
      address,
      role: "mechanic",
      isApproved: false,
      location: {
        type: "Point",
        coordinates: [Number.parseFloat(longitude) || 0, Number.parseFloat(latitude) || 0],
      },
    })

    const savedUser = await newUser.save()

    // Create mechanic profile
    const mechanicProfile = new MechanicProfile({
      user: savedUser._id,
      specialization: Array.isArray(specialization) ? specialization : [specialization],
      experience: Number.parseInt(experience),
      hourlyRate: Number.parseFloat(hourlyRate),
      documents,
    })

    await mechanicProfile.save()

    req.flash("success_msg", "Registration successful. Please wait for admin approval.")
    res.redirect("/auth/pending-approval")
  } catch (error) {
    console.error("Mechanic registration error:", error)
    req.flash("error_msg", "An error occurred during registration")
    res.redirect("/auth/register-mechanic")
  }
})

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

