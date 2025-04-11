const express = require("express");
const router = express.Router();
const User = require("../models/User");
const MechanicProfile = require("../models/MechanicProfile");
const Booking = require("../models/Booking");

// Admin dashboard
router.get("/dashboard", async (req, res) => {
  try {
    // Get counts
    const userCount = await User.countDocuments({ role: "user" });
    const mechanicCount = await User.countDocuments({
      role: "mechanic",
      isApproved: true,
    });
    const pendingMechanicCount = await User.countDocuments({
      role: "mechanic",
      isApproved: false,
    });
    const bookingCount = await Booking.countDocuments();

    // Get recent bookings
    const recentBookings = await Booking.find()
      .populate("user", "name")
      .populate("mechanic", "name")
      .sort({ createdAt: -1 })
      .limit(5);

    // Get booking stats
    const pendingBookings = await Booking.countDocuments({ status: "pending" });
    const acceptedBookings = await Booking.countDocuments({
      status: "accepted",
    });
    const inProgressBookings = await Booking.countDocuments({
      status: "in-progress",
    });
    const completedBookings = await Booking.countDocuments({
      status: "completed",
    });
    const cancelledBookings = await Booking.countDocuments({
      status: "cancelled",
    });

    // Get payment stats
    const completedPayments = await Booking.countDocuments({
      status: "completed",
      "payment.status": "completed",
    });

    const pendingPayments = await Booking.countDocuments({
      status: "completed",
      "payment.status": "pending",
    });

    // Calculate total revenue
    const revenue = await Booking.aggregate([
      { $match: { status: "completed", "payment.status": "completed" } },
      { $group: { _id: null, total: { $sum: "$payment.amount" } } },
    ]);

    const totalRevenue = revenue.length > 0 ? revenue[0].total : 0;

    res.render("admin/dashboard", {
      title: "Admin Dashboard",
      userCount,
      mechanicCount,
      pendingMechanicCount,
      bookingCount,
      recentBookings,
      bookingStats: {
        pending: pendingBookings,
        accepted: acceptedBookings,
        inProgress: inProgressBookings,
        completed: completedBookings,
        cancelled: cancelledBookings,
      },
      paymentStats: {
        completed: completedPayments,
        pending: pendingPayments,
        totalRevenue,
      },
    });
  } catch (error) {
    console.error("Admin dashboard error:", error);
    req.flash("error_msg", "Failed to load dashboard");
    res.redirect("/");
  }
});

// Manage users
router.get("/users", async (req, res) => {
  try {
    const users = await User.find({ role: "user" }).sort({ createdAt: -1 });

    res.render("admin/users", {
      title: "Manage Users",
      users,
    });
  } catch (error) {
    console.error("Manage users error:", error);
    req.flash("error_msg", "Failed to load users");
    res.redirect("/admin/dashboard");
  }
});

// View user details
router.get("/user/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      req.flash("error_msg", "User not found");
      return res.redirect("/admin/users");
    }

    // Get user's bookings
    const bookings = await Booking.find({ user: user._id })
      .populate("mechanic", "name")
      .sort({ createdAt: -1 });

    res.render("admin/user-details", {
      title: "User Details",
      user,
      bookings,
    });
  } catch (error) {
    console.error("User details error:", error);
    req.flash("error_msg", "Failed to load user details");
    res.redirect("/admin/users");
  }
});

// Manage mechanics
router.get("/mechanics", async (req, res) => {
  try {
    const mechnicWithProfile = await MechanicProfile.find({}).populate(
      "user",
      "_id name email phone address role isApproved"
    );
    const approvedMechanics = mechnicWithProfile.filter(
      (mechanic) => mechanic.user.isApproved === true
    );
    const pendingMechanics = mechnicWithProfile.filter(
      (mechanic) => mechanic.user.isApproved === false
    );

    // const allMechanics = [...pendingMechanics, ...approvedMechanics]
    // console.log(mechanics);
    res.render("admin/mechanics", {
      title: "Manage Mechanics",
      mechanics: mechnicWithProfile,
      pendingMechanics,
      approvedMechanics,
    });
  } catch (error) {
    console.error("Manage mechanics error:", error);
    req.flash("error_msg", "Failed to load mechanics");
    res.redirect("/admin/dashboard");
  }
});

// View mechanic details
router.get("/mechanic/:id", async (req, res) => {
  try {
    const mechanic = await User.findById(req.params.id);

    if (!mechanic) {
      req.flash("error_msg", "Mechanic not found");
      return res.redirect("/admin/mechanics");
    }

    // Get mechanic profile
    const profile = await MechanicProfile.findOne({ user: mechanic._id });

    // Get mechanic's bookings
    const bookings = await Booking.find({ mechanic: mechanic._id })
      .populate("user", "name")
      .sort({ createdAt: -1 });

    res.render("admin/mechanic-details", {
      title: "Mechanic Details",
      mechanic,
      profile,
      bookings,
    });
  } catch (error) {
    console.error("Mechanic details error:", error);
    req.flash("error_msg", "Failed to load mechanic details");
    res.redirect("/admin/mechanics");
  }
});

// Approve mechanic
router.post("/mechanic/:id/approve", async (req, res) => {
  try {
    const mechanic = await User.findById(req.params.id);

    if (!mechanic) {
      req.flash("error_msg", "Mechanic not found");
      return res.redirect("/admin/mechanics");
    }

    mechanic.isApproved = true;
    await mechanic.save();

    req.flash("success_msg", "Mechanic approved successfully");
    res.redirect("/admin/mechanics");
  } catch (error) {
    console.error("Approve mechanic error:", error);
    req.flash("error_msg", "Failed to approve mechanic");
    res.redirect("/admin/mechanics");
  }
});

// Reject mechanic
router.post("/mechanic/:id/reject", async (req, res) => {
  try {
    const mechanic = await User.findById(req.params.id);

    if (!mechanic) {
      req.flash("error_msg", "Mechanic not found");
      return res.redirect("/admin/mechanics");
    }

    // Delete mechanic profile
    await MechanicProfile.findOneAndDelete({ user: mechanic._id });

    // Delete mechanic user
    await User.findByIdAndDelete(mechanic._id);

    req.flash("success_msg", "Mechanic rejected and removed");
    res.redirect("/admin/mechanics");
  } catch (error) {
    console.error("Reject mechanic error:", error);
    req.flash("error_msg", "Failed to reject mechanic");
    res.redirect("/admin/mechanics");
  }
});

// Manage bookings
router.get("/bookings", async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate("user", "name")
      .populate("mechanic", "name")
      .sort({ createdAt: -1 });

    const bookingStats = {
      total: await Booking.countDocuments(),
      active: await Booking.countDocuments({ status: "active" }),
      completed: await Booking.countDocuments({ status: "completed" }),
      cancelled: await Booking.countDocuments({ status: "cancelled" }),
    };

    res.render("admin/bookings", {
      title: "Manage Bookings",
      bookings,
      bookingStats,
    });
  } catch (error) {
    console.error("Manage bookings error:", error);
    req.flash("error_msg", "Failed to load bookings");
    res.redirect("/admin/dashboard");
  }
});

// View booking details
router.get("/booking/:id", async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("user", "name phone address")
      .populate("mechanic", "name phone");

    if (!booking) {
      req.flash("error_msg", "Booking not found");
      return res.redirect("/admin/bookings");
    }
    const mechanic = await User.findById(booking.mechanic);
    if (!mechanic) {
      req.flash("error_msg", "Mechanic not found");
      return res.redirect("/admin/bookings");
    }
    const availableMechanics = await User.find({
      role: "mechanic",
      isApproved: true,
    }).sort({ createdAt: -1 });

    res.render("admin/booking-details", {
      title: "Booking Details",
      booking,
      mechanic,
      availableMechanics,
      paymentStatus: booking.payment.status,
    });
  } catch (error) {
    console.error("Booking details error:", error);
    req.flash("error_msg", "Failed to load booking details");
    res.redirect("/admin/bookings");
  }
});

// Manage payments
router.get("/payments", async (req, res) => {
  try {
    const payments = await Booking.find({
      status: "completed",
      "payment.amount": { $gt: 0 },
    })
      .populate("user", "name")
      .populate("mechanic", "name")
      .sort({ updatedAt: -1 });

    const totalRevenue = await Booking.aggregate([
      { $match: { status: "completed", "payment.status": "completed" } },
      { $group: { _id: null, total: { $sum: "$payment.amount" } } },
    ]);
    const total = totalRevenue.length > 0 ? totalRevenue[0].total : 0;
    const paymentStats = {
      total,
      completed: await Booking.countDocuments({
        status: "completed",
        "payment.status": "completed",
      }),
      pending: await Booking.countDocuments({
        status: "completed",
        "payment.status": "pending",
      }),
    };
    const completedPayments = await Booking.countDocuments({
      status: "completed",
      "payment.status": "completed",
    });
    const pendingPayments = await Booking.countDocuments({
      status: "completed",
      "payment.status": "pending",
    });

    res.render("admin/payments", {
      title: "Manage Payments",
      payments,
      paymentStats,
      totalRevenue: total,
      completedPayments,
      pendingPayments,
    });
  } catch (error) {
    console.error("Manage payments error:", error);
    req.flash("error_msg", "Failed to load payments");
    res.redirect("/admin/dashboard");
  }
});

module.exports = router;
