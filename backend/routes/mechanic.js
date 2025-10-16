const express = require("express");
const router = express.Router();
const User = require("../models/User");
const MechanicProfile = require("../models/MechanicProfile");
const Booking = require("../models/Booking");
const Chat = require("../models/Chat");
const path = require("path");

// Mechanic dashboard
router.get("/dashboard", (req, res) => {
  res.render("mechanic/dashboard", { title: "Mechanic Dashboard" });
});

// API: dashboard data as JSON (used by the static HTML)
router.get("/api/dashboard", async (req, res) => {
  try {
    const profile = await MechanicProfile.findOne({ user: req.user._id });
    const bookings = await Booking.find({ mechanic: req.user._id })
      .populate("user", "name phone")
      .sort({ createdAt: -1 });

    const stats = {
      total: bookings.length,
      pending: bookings.filter((b) => b.status === "pending").length,
      inProgress: bookings.filter((b) => b.status === "in-progress").length,
      completed: bookings.filter((b) => b.status === "completed").length,
      cancelled: bookings.filter((b) => b.status === "cancelled").length,
    };

    const completedBookings = bookings.filter(
      (b) => b.status === "completed" && b.payment && b.payment.status === "completed"
    );
    const totalEarnings = completedBookings.reduce(
      (sum, booking) => sum + (booking.payment?.amount || 0),
      0
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayBookings = completedBookings.filter(
      (b) => new Date(b.updatedAt) >= today
    );
    const todayEarnings = todayBookings.reduce(
      (sum, booking) => sum + (booking.payment?.amount || 0),
      0
    );

    const nearbyBookings = await Booking.find({
      status: "pending",
      mechanic: null,
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: req.user.location.coordinates,
          },
          $maxDistance: 10000,
        },
      },
    })
      .populate("user", "name")
      .limit(5);

    const userRequestedJob = await Booking.find({
      mechanic: req.user._id,
      status: "pending",
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: req.user.location.coordinates,
          },
          $maxDistance: 10000,
        },
      },
    }).populate("user", "name");

    res.json({
      title: "Mechanic Dashboard",
      user: req.user,
      profile,
      bookings,
      stats,
      totalEarnings,
      todayEarnings,
      nearbyBookings,
      userRequestedJob,
      flash: {
        success_msg: req.flash('success_msg') || [],
        error_msg: req.flash('error_msg') || [],
        error: req.flash('error') || [],
      },
    });
  } catch (error) {
    console.error("Mechanic dashboard API error:", error);
    res.status(500).json({ error: "Failed to load dashboard data" });
  }
});

// View booking details
router.get('/booking/:id', (req, res) => {
  res.render("mechanic/booking-details", { title: "Booking Details" });
});

// API: booking details
router.get('/api/booking/:id', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('user', 'name phone address')
      .populate('mechanic', 'name phone');

  if (!booking) return res.status(404).json({ error: 'Booking not found' });

    if (booking.mechanic && booking.mechanic._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const chat = await Chat.findOne({ booking: booking._id });
    const profile = await MechanicProfile.findOne({ user: req.user._id });

  res.json({ booking, chat, profile, user: req.user, flash: { success_msg: req.flash('success_msg') || [], error_msg: req.flash('error_msg') || [], error: req.flash('error') || [] } });
  } catch (error) {
    console.error('Booking API error:', error);
    res.status(500).json({ error: 'Failed to load booking details' });
  }
});

// Accept booking
router.post("/booking/:id/accept", async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      req.flash("error_msg", "Booking not found");
      return res.redirect("/mechanic/dashboard");
    }

    // Check if booking is in pending state
    if (booking.status !== "pending") {
      req.flash("error_msg", "Booking is not in pending state");
      return res.redirect(`/mechanic/booking/${booking._id}`);
    }

    // Update booking status
    booking.mechanic = req.user._id;
    booking.status = "accepted";
    booking.updatedAt = new Date();
    await booking.save();

    // Create a chat for this booking if it doesn't exist
    let chat = await Chat.findOne({ booking: booking._id });
    if (!chat) {
      chat = new Chat({
        booking: booking._id,
        participants: [booking.user, req.user._id],
      });
      await chat.save();
    }

    req.flash("success_msg", "Booking accepted successfully");
    res.redirect(`/mechanic/booking/${booking._id}`);
  } catch (error) {
    console.error("Accept booking error:", error);
    req.flash("error_msg", "Failed to accept booking");
    res.redirect(`/mechanic/booking/${req.params.id}`);
  }
});

// Start service
router.post("/booking/:id/start", async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      req.flash("error_msg", "Booking not found");
      return res.redirect("/mechanic/dashboard");
    }

    // Check if mechanic is authorized
    if (booking.mechanic.toString() !== req.user._id.toString()) {
      req.flash("error_msg", "Not authorized");
      return res.redirect("/mechanic/dashboard");
    }

    // Check if booking is in accepted state
    if (booking.status !== "accepted") {
      req.flash("error_msg", "Booking is not in accepted state");
      return res.redirect(`/mechanic/booking/${booking._id}`);
    }

    // Update booking status
    booking.status = "in-progress";
    booking.updatedAt = new Date();
    await booking.save();

    req.flash("success_msg", "Service started successfully");
    res.redirect(`/mechanic/booking/${booking._id}`);
  } catch (error) {
    console.error("Start service error:", error);
    req.flash("error_msg", "Failed to start service");
    res.redirect(`/mechanic/booking/${req.params.id}`);
  }
});

// Complete service
router.post("/booking/:id/complete", async (req, res) => {
  try {
    const { amount, notes } = req.body;

    if (!amount) {
      req.flash("error_msg", "Please enter the service amount");
      return res.redirect(`/mechanic/booking/${req.params.id}`);
    }

    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      req.flash("error_msg", "Booking not found");
      return res.redirect("/mechanic/dashboard");
    }

    // Check if mechanic is authorized
    if (booking.mechanic.toString() !== req.user._id.toString()) {
      req.flash("error_msg", "Not authorized");
      return res.redirect("/mechanic/dashboard");
    }

    // Check if booking is in in-progress state
    if (booking.status !== "in-progress") {
      req.flash("error_msg", "Booking is not in in-progress state");
      return res.redirect(`/mechanic/booking/${booking._id}`);
    }

    // Update booking status and payment info
    booking.status = "completed";
    booking.payment.amount = Number.parseFloat(amount);
    booking.notes = notes;
    booking.updatedAt = new Date();
    await booking.save();

    // Emit socket event to notify user and mechanic (if online)
    try {
      const io = req.app.get('io');
      if (io) {
        const notifyUsers = [booking.user.toString()];
        if (booking.mechanic) notifyUsers.push(booking.mechanic.toString());

        notifyUsers.forEach((userId) => {
          try {
            io.to(userId).emit('booking-status-changed', {
              bookingId: booking._id.toString(),
              status: booking.status,
              updatedAt: booking.updatedAt,
            });
          } catch (e) {
            // fallback to global emit
            io.emit('booking-status-changed', {
              bookingId: booking._id.toString(),
              status: booking.status,
              updatedAt: booking.updatedAt,
            });
          }
        });
      }
    } catch (emitErr) {
      console.error('Error emitting booking status change:', emitErr);
    }

    req.flash("success_msg", "Service completed successfully");
    res.redirect(`/mechanic/booking/${booking._id}`);
  } catch (error) {
    console.error("Complete service error:", error);
    req.flash("error_msg", "Failed to complete service");
    res.redirect(`/mechanic/booking/${req.params.id}`);
  }
});

// View booking history
router.get('/history', (req, res) => {
  res.render("mechanic/history", { title: "Job History" });
});

router.get('/api/history', async (req, res) => {
  try {
    const bookings = await Booking.find({ mechanic: req.user._id })
      .populate('user', 'name')
      .sort({ createdAt: -1 });
    const profile = await MechanicProfile.findOne({ user: req.user._id });
  res.json({ bookings, user: req.user, profile, flash: { success_msg: req.flash('success_msg') || [], error_msg: req.flash('error_msg') || [], error: req.flash('error') || [] } });
  } catch (error) {
    console.error('History API error:', error);
    res.status(500).json({ error: 'Failed to load booking history' });
  }
});

// Profile page
router.get('/profile', (req, res) => {
  res.render("mechanic/profile", { title: "My Profile" });
});

router.get('/api/profile', async (req, res) => {
  try {
    const profile = await MechanicProfile.findOne({ user: req.user._id });
  res.json({ user: req.user, profile, flash: { success_msg: req.flash('success_msg') || [], error_msg: req.flash('error_msg') || [], error: req.flash('error') || [] } });
  } catch (error) {
    console.error('Profile API error:', error);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

// Update profile
router.post("/profile", async (req, res) => {
  try {
    const {
      name,
      phone,
      address,
      latitude,
      longitude,
      specialization,
      experience,
      hourlyRate,
    } = req.body;

    // Validation
    if (
      !name ||
      !phone ||
      !address ||
      !specialization ||
      !experience ||
      !hourlyRate
    ) {
      req.flash("error_msg", "Please fill in all fields");
      return res.redirect("/mechanic/profile");
    }

    // Update user
    await User.findByIdAndUpdate(req.user._id, {
      name,
      phone,
      address,
      location: {
        type: "Point",
        coordinates: [
          Number.parseFloat(longitude) || 0,
          Number.parseFloat(latitude) || 0,
        ],
      },
    });

    // Update mechanic profile
    await MechanicProfile.findOneAndUpdate(
      { user: req.user._id },
      {
        specialization: Array.isArray(specialization)
          ? specialization
          : [specialization],
        experience: Number.parseInt(experience),
        hourlyRate: Number.parseFloat(hourlyRate),
      }
    );

    req.flash("success_msg", "Profile updated successfully");
    res.redirect("/mechanic/profile");
  } catch (error) {
    console.error("Update profile error:", error);
    req.flash("error_msg", "Failed to update profile");
    res.redirect("/mechanic/profile");
  }
});

// Toggle availability
router.post("/toggle-availability", async (req, res) => {
  try {
    const profile = await MechanicProfile.findOne({ user: req.user._id });

    profile.availability = !profile.availability;
    await profile.save();

    req.flash(
      "success_msg",
      `You are now ${
        profile.availability ? "available" : "unavailable"
      } for new bookings`
    );
    res.redirect("/mechanic/dashboard");
  } catch (error) {
    console.error("Toggle availability error:", error);
    req.flash("error_msg", "Failed to update availability");
    res.redirect("/mechanic/dashboard");
  }
});

module.exports = router;
