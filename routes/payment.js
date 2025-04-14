const express = require("express")
const router = express.Router()
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)
const Booking = require("../models/Booking")
const Subscription = require("../models/Subscription")
const User = require("../models/User")

// Process payment page
router.get("/:bookingId", async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId).populate("mechanic", "name").populate("user", "name")

    if (!booking) {
      req.flash("error_msg", "Booking not found")
      return res.redirect("/")
    }

    // Check if user is authorized
    if (booking.user._id.toString() !== req.user._id.toString()) {
      req.flash("error_msg", "Not authorized")
      return res.redirect("/")
    }

    // Check if booking is completed and payment is pending
    if (booking.status !== "completed" || booking.payment.status !== "pending") {
      req.flash("error_msg", "Payment not required for this booking")
      return res.redirect("/user/booking/" + booking._id)
    }

    // Get user's subscription to apply discounts
    const subscription = await Subscription.findOne({
      user: req.user._id,
      status: "active",
      expiresAt: { $gt: new Date() },
    })

    let discountPercentage = 0
    if (subscription) {
      discountPercentage = subscription.plan === "yearly" ? 15 : 10
    }

    // Calculate discounted amount if applicable
    let originalAmount = booking.payment.amount
    let discountedAmount = originalAmount
    
    if (discountPercentage > 0) {
      discountedAmount = originalAmount * (1 - discountPercentage / 100)
      // Round to 2 decimal places
      discountedAmount = Math.round(discountedAmount * 100) / 100
    }

    res.render("payment/checkout", {
      title: "Payment",
      booking,
      originalAmount,
      discountedAmount,
      discountPercentage,
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    })
  } catch (error) {
    console.error("Payment page error:", error)
    req.flash("error_msg", "Failed to load payment page")
    res.redirect("/")
  }
})

// Process payment
// router.post("/:bookingId/process", async (req, res) => {
//   try {
//     const { paymentMethodId } = req.body

//     const booking = await Booking.findById(req.params.bookingId)

//     if (!booking) {
//       return res.status(404).json({ success: false, message: "Booking not found" })
//     }

//     // Check if user is authorized
//     if (booking.user.toString() !== req.user._id.toString()) {
//       return res.status(403).json({ success: false, message: "Not authorized" })
//     }

//     // Apply discount if user has premium subscription
//     let amountToCharge = booking.payment.amount
    
//     const subscription = await Subscription.findOne({
//       user: req.user._id,
//       status: "active",
//       expiresAt: { $gt: new Date() },
//     })

//     if (subscription) {
//       const discountPercentage = subscription.plan === "yearly" ? 15 : 10
//       amountToCharge = amountToCharge * (1 - discountPercentage / 100)
//       // Round to 2 decimal places and ensure it's not less than $1
//       amountToCharge = Math.max(Math.round(amountToCharge * 100) / 100, 1)
//     }

//     // Create payment intent
//     const paymentIntent = await stripe.paymentIntents.create({
//       amount: Math.round(amountToCharge * 100), // Convert to cents
//       currency: "usd",
//       payment_method: paymentMethodId,
//       confirm: true,
//       description: `Payment for booking #${booking._id}`,
//     })

//     // Update booking payment status
//     booking.payment.status = "completed"
//     booking.payment.transactionId = paymentIntent.id
    
//     // Record the discount if applied
//     if (subscription) {
//       booking.payment.discountApplied = booking.payment.amount - amountToCharge
//       booking.payment.discountPercentage = subscription.plan === "yearly" ? 15 : 10
//     }
    
//     await booking.save()

//     return res.status(200).json({ success: true, message: "Payment successful" })
//   } catch (error) {
//     console.error("Payment process error:", error)
//     return res.status(500).json({ success: false, message: error.message })
//   }
// })

// Subscription payment processing
router.post("/premium/process", async (req, res) => {
  try {
    const { plan, paymentMethodId } = req.body
    console.log("Received plan:", plan)
    console.log("Received paymentMethodId:", paymentMethodId)
    if (!["monthly", "yearly"].includes(plan)) {
      return res.status(400).json({ success: false, message: "Invalid plan selected" })
    }

    // Calculate amount based on plan
    const amount = plan === "monthly" ? 999 : 9999 // $9.99 or $99.99

    // Create a payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount, // Already in cents
      currency: "usd",
      payment_method: paymentMethodId,
      confirm: true,
      description: `Premium ${plan} subscription for ${req.user.email}`,
      receipt_email: req.user.email,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: "never",
      },

    })

    // Calculate expiration date
    const expiresAt = new Date()
    if (plan === "monthly") {
      expiresAt.setMonth(expiresAt.getMonth() + 1)
    } else {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1)
    }

    // Create subscription
    const subscription = new Subscription({
      user: req.user._id,
      plan,
      amount: amount / 100, // Convert cents to dollars
      status: "active",
      paymentIntentId: paymentIntent.id,
      paymentMethod: "stripe",
      startDate: new Date(),
      expiresAt,
      features: {
        priorityService: true,
        tracking: true,
        discountPercentage: plan === "yearly" ? 15 : 10,
        emergencyAssistance: plan === "yearly",
        freeTowing: plan === "yearly" ? 2 : 0,
        maintenanceChecks: plan === "yearly",
      },
    })

    await subscription.save()

    // Update user's premium status
    await User.findByIdAndUpdate(req.user._id, {
      isPremium: true,
      premiumTier: plan,
      premiumFeatures: {
        priorityService: true,
        tracking: true,
        discounts: plan === "yearly" ? 15 : 10,
        emergencyAssistance: plan === "yearly",
        freeTowing: plan === "yearly" ? 2 : 0,
        maintenanceChecks: plan === "yearly",
      },
    })
    console.log("Subscription created:", subscription)
    return res.status(200).json({ 
      success: true, 
      message: "Subscription payment successful",
      redirectUrl: "/user/premium/success",
    })
  } catch (error) {
    console.error("Subscription payment error:", error)
    return res.status(500).json({ success: false, message: error.message })
  }
})

// Payment success page
router.get("/:bookingId/success", async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId).populate("mechanic", "name").populate("user", "name")

    if (!booking) {
      req.flash("error_msg", "Booking not found")
      return res.redirect("/")
    }

    res.render("payment/success", {
      title: "Payment Successful",
      booking,
    })
  } catch (error) {
    console.error("Payment success page error:", error)
    req.flash("error_msg", "Failed to load payment success page")
    res.redirect("/")
  }
})

// Subscription success page
router.get("/premium/success", (req, res) => {
  res.render("payment/subscription-success", {
    title: "Subscription Successful",
    user: req.user,
  })
})

module.exports = router
