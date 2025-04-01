const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const Booking = require("../models/Booking");

// Process payment page
router.get("/:bookingId", async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId)
      .populate("mechanic", "name")
      .populate("user", "name");

    if (!booking) {
      req.flash("error_msg", "Booking not found");
      return res.redirect("/");
    }

    // Check if user is authorized
    if (booking.user._id.toString() !== req.user._id.toString()) {
      req.flash("error_msg", "Not authorized");
      return res.redirect("/");
    }

    // Check if booking is completed and payment is pending
    if (
      booking.status !== "completed" ||
      booking.payment.status !== "pending"
    ) {
      req.flash("error_msg", "Payment not required for this booking");
      return res.redirect("/user/booking/" + booking._id);
    }

    res.render("payment/checkout", {
      title: "Payment",
      booking,
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    });
  } catch (error) {
    console.error("Payment page error:", error);
    req.flash("error_msg", "Failed to load payment page");
    res.redirect("/");
  }
});

// Process payment
router.post("/:bookingId/process", async (req, res) => {
  try {
    const { paymentMethodId } = req.body;

    const booking = await Booking.findById(req.params.bookingId);

    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }

    // Check if user is authorized
    if (booking.user.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(booking.payment.amount * 100),
      currency: "usd",
      payment_method: paymentMethodId,
      confirm: true,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: "never",
      },
      description: `Payment for booking #${booking._id}`,
    });

    // Update booking payment status
    booking.payment.status = "completed";
    booking.payment.transactionId = paymentIntent.id;
    await booking.save();

    return res
      .status(200)
      .json({ success: true, message: "Payment successful" });
  } catch (error) {
    console.error("Payment process error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Payment success page
router.get("/:bookingId/success", async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId)
      .populate("mechanic", "name")
      .populate("user", "name");

    if (!booking) {
      req.flash("error_msg", "Booking not found");
      return res.redirect("/");
    }

    res.render("payment/success", {
      title: "Payment Successful",
      booking,
    });
  } catch (error) {
    console.error("Payment success page error:", error);
    req.flash("error_msg", "Failed to load payment success page");
    res.redirect("/");
  }
});

module.exports = router;
