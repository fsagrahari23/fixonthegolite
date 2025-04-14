const express = require("express")
const router = express.Router()
const User = require("../models/User")
const MechanicProfile = require("../models/MechanicProfile")
const Booking = require("../models/Booking")
const Subscription = require("../models/Subscription")

// Admin dashboard
// Admin dashboard
router.get("/dashboard", async (req, res) => {
  try {
    // Get counts
    const userCount = await User.countDocuments({ role: "user" })
    const mechanicCount = await User.countDocuments({ role: "mechanic", isApproved: true })
    const pendingMechanicCount = await User.countDocuments({ role: "mechanic", isApproved: false })
    const bookingCount = await Booking.countDocuments()
    const premiumUserCount = await User.countDocuments({ isPremium: true })

    // Get recent bookings
    const recentBookings = await Booking.find()
      .populate("user", "name")
      .populate("mechanic", "name")
      .sort({ createdAt: -1 })
      .limit(5)

    // Get booking stats
    const pendingBookings = await Booking.countDocuments({ status: "pending" })
    const acceptedBookings = await Booking.countDocuments({ status: "accepted" })
    const inProgressBookings = await Booking.countDocuments({ status: "in-progress" })
    const completedBookings = await Booking.countDocuments({ status: "completed" })
    const cancelledBookings = await Booking.countDocuments({ status: "cancelled" })
    const emergencyBookings = await Booking.countDocuments({ emergencyRequest: true })

    // Get payment stats
    const completedPayments = await Booking.countDocuments({
      status: "completed",
      "payment.status": "completed",
    })

    const pendingPayments = await Booking.countDocuments({
      status: "completed",
      "payment.status": "pending",
    })

    // Calculate total revenue from bookings
    const bookingRevenue = await Booking.aggregate([
      { $match: { status: "completed", "payment.status": "completed" } },
      { $group: { _id: null, total: { $sum: "$payment.amount" } } },
    ])

    // Calculate total revenue from subscriptions
    const subscriptionRevenue = await Subscription.aggregate([
      { $match: { status: "active" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ])

    const bookingTotal = bookingRevenue.length > 0 ? bookingRevenue[0].total : 0
    const subscriptionTotal = subscriptionRevenue.length > 0 ? subscriptionRevenue[0].total : 0
    const totalRevenue = bookingTotal + subscriptionTotal

    // Get premium subscription stats
    const activeSubscriptions = await Subscription.countDocuments({
      status: "active",
      expiresAt: { $gt: new Date() },
    })
    const monthlySubscriptions = await Subscription.countDocuments({
      status: "active",
      plan: "monthly",
      expiresAt: { $gt: new Date() },
    })
    const yearlySubscriptions = await Subscription.countDocuments({
      status: "active",
      plan: "yearly",
      expiresAt: { $gt: new Date() },
    })

    // Get recent subscriptions
    const recentSubscriptions = await Subscription.find()
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .limit(5)

      // monthly revenue with booking + subscription
      // Monthly Revenue Stats - Bookings
const bookingMonthlyRevenue = await Booking.aggregate([
  {
    $match: {
      status: "completed",
      "payment.status": "completed",
    },
  },
  {
    $group: {
      _id: {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
      },
      total: { $sum: "$payment.amount" },
    },
  },
  {
    $sort: { "_id.year": 1, "_id.month": 1 },
  },
])

// Monthly Revenue Stats - Subscriptions
const subscriptionMonthlyRevenue = await Subscription.aggregate([
  {
    $match: {
      status: "active",
    },
  },
  {
    $group: {
      _id: {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
      },
      total: { $sum: "$amount" },
    },
  },
  {
    $sort: { "_id.year": 1, "_id.month": 1 },
  },
])

// Combine both sources into a unified revenue map
const monthlyRevenueMap = {}

bookingMonthlyRevenue.forEach(({ _id, total }) => {
  const key = `${_id.year}-${String(_id.month).padStart(2, "0")}`
  monthlyRevenueMap[key] = { booking: total, subscription: 0 }
})

subscriptionMonthlyRevenue.forEach(({ _id, total }) => {
  const key = `${_id.year}-${String(_id.month).padStart(2, "0")}`
  if (!monthlyRevenueMap[key]) {
    monthlyRevenueMap[key] = { booking: 0, subscription: total }
  } else {
    monthlyRevenueMap[key].subscription = total
  }
})

// Format the final monthly revenue chart data
const monthlyRevenueStats = Object.keys(monthlyRevenueMap).map((month) => {
  return {
    month, // Format: "2025-04"
    booking: monthlyRevenueMap[month].booking,
    subscription: monthlyRevenueMap[month].subscription,
    total: monthlyRevenueMap[month].booking + monthlyRevenueMap[month].subscription,
  }
}).sort((a, b) => a.month.localeCompare(b.month)) // Ensure chronological order

console.log("Monthly Revenue Stats:", monthlyRevenueStats)

    res.render("admin/dashboard", {
      title: "Admin Dashboard",
      userCount,
      mechanicCount,
      pendingMechanicCount,
      bookingCount,
      premiumUserCount,
      recentBookings,
      bookingStats: {
        pending: pendingBookings,
        accepted: acceptedBookings,
        inProgress: inProgressBookings,
        completed: completedBookings,
        cancelled: cancelledBookings,
        emergency: emergencyBookings,
      },
      paymentStats: {
        completed: completedPayments,
        pending: pendingPayments,
        bookingRevenue: bookingTotal,
        subscriptionRevenue: subscriptionTotal,
        totalRevenue,
      },
      subscriptionStats: {
        active: activeSubscriptions,
        monthly: monthlySubscriptions,
        yearly: yearlySubscriptions,
      },
      recentSubscriptions,
      monthlyRevenueStats,
    })
  } catch (error) {
    console.error("Admin dashboard error:", error)
    req.flash("error_msg", "Failed to load dashboard")
    res.redirect("/")
  }
})
// Manage users
router.get("/users", async (req, res) => {
  try {
    // Get users with premium information
    const users = await User.find({ role: "user" }).sort({ createdAt: -1 })

    // Get premium status for each user
    const userIds = users.map((user) => user._id)
    const subscriptions = await Subscription.find({
      user: { $in: userIds },
      status: "active",
      expiresAt: { $gt: new Date() },
    })

    // Create a map of user ID to premium status
    const premiumUsersMap = {}
    subscriptions.forEach((sub) => {
      premiumUsersMap[sub.user.toString()] = {
        plan: sub.plan,
        expiresAt: sub.expiresAt,
      }
    })

    // Add booking count for each user
    const userBookingCounts = await Booking.aggregate([
      { $match: { user: { $in: userIds } } },
      { $group: { _id: "$user", count: { $sum: 1 } } },
    ])

    const bookingCountMap = {}
    userBookingCounts.forEach((item) => {
      bookingCountMap[item._id.toString()] = item.count
    })

    // Add premium and booking count info to users
    const usersWithInfo = users.map((user) => {
      const userObj = user.toObject()
      userObj.premium = premiumUsersMap[user._id.toString()] || null
      userObj.bookingCount = bookingCountMap[user._id.toString()] || 0
      return userObj
    })

    res.render("admin/users", {
      title: "Manage Users",
      users: usersWithInfo,
    })
  } catch (error) {
    console.error("Manage users error:", error)
    req.flash("error_msg", "Failed to load users")
    res.redirect("/admin/dashboard")
  }
})

// View user details
router.get("/user/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id)

    if (!user) {
      req.flash("error_msg", "User not found")
      return res.redirect("/admin/users")
    }

    // Get user's bookings
    const bookings = await Booking.find({ user: user._id }).populate("mechanic", "name").sort({ createdAt: -1 })

    // Get premium subscription info
    const subscription = await Subscription.findOne({
      user: user._id,
      status: "active",
      expiresAt: { $gt: new Date() },
    })

    res.render("admin/user-details", {
      title: "User Details",
      user,
      bookings,
      subscription,
    })
  } catch (error) {
    console.error("User details error:", error)
    req.flash("error_msg", "Failed to load user details")
    res.redirect("/admin/users")
  }
})

// Manage mechanics
router.get("/mechanics", async (req, res) => {
  try {
    const mechanics = await User.find({ role: "mechanic" }).sort({ isApproved: 1, createdAt: -1 });

    const pendingUsers = await User.find({ role: "mechanic", isApproved: false });
    const approvedUsers = await User.find({ role: "mechanic", isApproved: true });

    const pendingMechanics = await MechanicProfile.find({ user: { $in: pendingUsers.map(u => u._id) } }).populate("user", "name email phone");
    const approvedMechanics = await MechanicProfile.find({ user: { $in: approvedUsers.map(u => u._id) } }).populate("user", "name email phone");

    console.log("Pending Mechanics:", pendingMechanics);
    console.log("Approved Mechanics:", approvedMechanics);

    res.render("admin/mechanics", {
      title: "Manage Mechanics",
      mechanics,
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
    const mechanic = await User.findById(req.params.id)

    if (!mechanic) {
      req.flash("error_msg", "Mechanic not found")
      return res.redirect("/admin/mechanics")
    }

    // Get mechanic profile
    const profile = await MechanicProfile.findOne({ user: mechanic._id }).populate("reviews.user", "name")

    // Get mechanic's bookings
    const bookings = await Booking.find({ mechanic: mechanic._id }).populate("user", "name").sort({ createdAt: -1 })

    res.render("admin/mechanic-details", {
      title: "Mechanic Details",
      mechanic,
      profile,
      bookings,
    })
  } catch (error) {
    console.error("Mechanic details error:", error)
    req.flash("error_msg", "Failed to load mechanic details")
    res.redirect("/admin/mechanics")
  }
})

// Approve mechanic
router.post("/mechanic/:id/approve", async (req, res) => {
  try {
    const mechanic = await User.findById(req.params.id)

    if (!mechanic) {
      req.flash("error_msg", "Mechanic not found")
      return res.redirect("/admin/mechanics")
    }

    mechanic.isApproved = true
    await mechanic.save()

    req.flash("success_msg", "Mechanic approved successfully")
    res.redirect("/admin/mechanics")
  } catch (error) {
    console.error("Approve mechanic error:", error)
    req.flash("error_msg", "Failed to approve mechanic")
    res.redirect("/admin/mechanics")
  }
})

// Reject mechanic
router.post("/mechanic/:id/reject", async (req, res) => {
  try {
    const mechanic = await User.findById(req.params.id)

    if (!mechanic) {
      req.flash("error_msg", "Mechanic not found")
      return res.redirect("/admin/mechanics")
    }

    // Delete mechanic profile
    await MechanicProfile.findOneAndDelete({ user: mechanic._id })

    // Delete mechanic user
    await User.findByIdAndDelete(mechanic._id)

    req.flash("success_msg", "Mechanic rejected and removed")
    res.redirect("/admin/mechanics")
  } catch (error) {
    console.error("Reject mechanic error:", error)
    req.flash("error_msg", "Failed to reject mechanic")
    res.redirect("/admin/mechanics")
  }
})

// Manage bookings
router.get("/bookings", async (req, res) => {
  try {
    const bookings = await Booking.find().populate("user", "name").populate("mechanic", "name").sort({ createdAt: -1 })

    res.render("admin/bookings", {
      title: "Manage Bookings",
      bookings,
    })
  } catch (error) {
    console.error("Manage bookings error:", error)
    req.flash("error_msg", "Failed to load bookings")
    res.redirect("/admin/dashboard")
  }
})

// View booking details
router.get("/booking/:id", async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("user", "name phone address")
      .populate("mechanic", "name phone")

    if (!booking) {
      req.flash("error_msg", "Booking not found")
      return res.redirect("/admin/bookings")
    }

    res.render("admin/booking-details", {
      title: "Booking Details",
      booking,
    })
  } catch (error) {
    console.error("Booking details error:", error)
    req.flash("error_msg", "Failed to load booking details")
    res.redirect("/admin/bookings")
  }
})

// Manage payments
router.get("/payments", async (req, res) => {
  try {
    // Get completed booking payments
    const payments = await Booking.find({
      status: "completed",
      "payment.amount": { $gt: 0 },
    })
      .populate("user", "name")
      .populate("mechanic", "name")
      .sort({ updatedAt: -1 });

    // Get active subscriptions with payment info
    const subscriptions = await Subscription.find({
      status: "active",
      amount: { $gt: 0 },
    })
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    // Calculate total booking revenue
    const bookingRevenue = await Booking.aggregate([
      { $match: { status: "completed", "payment.status": "completed" } },
      { $group: { _id: null, total: { $sum: "$payment.amount" } } },
    ]);

    const bookingTotal = bookingRevenue.length > 0 ? bookingRevenue[0].total : 0;

    // Calculate total subscription revenue
    const subscriptionRevenue = await Subscription.aggregate([
      { $match: { status: "active" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const subscriptionTotal = subscriptionRevenue.length > 0 ? subscriptionRevenue[0].total : 0;

    const totalAmount = bookingTotal + subscriptionTotal;

    res.render("admin/payments", {
      title: "Manage Payments",
      payments,
      subscriptions,
      totalAmount,
      bookingTotal,
      subscriptionTotal,
    });
  } catch (error) {
    console.error("Manage payments error:", error);
    req.flash("error_msg", "Failed to load payments");
    res.redirect("/admin/dashboard");
  }
});


// Manage premium subscriptions
router.get("/subscriptions", async (req, res) => {
  try {
    const subscriptions = await Subscription.find()
      .populate("user", "name email phone")
      .sort({ createdAt: -1 })

    res.render("admin/subscriptions", {
      title: "Manage Subscriptions",
      subscriptions,
    })
  } catch (error) {
    console.error("Manage subscriptions error:", error)
    req.flash("error_msg", "Failed to load subscriptions")
    res.redirect("/admin/dashboard")
  }
})

// Subscription details
router.get("/subscription/:id", async (req, res) => {
  try {
    const subscription = await Subscription.findById(req.params.id).populate("user", "name email phone address")

    if (!subscription) {
      req.flash("error_msg", "Subscription not found")
      return res.redirect("/admin/subscriptions")
    }

    res.render("admin/subscription-details", {
      title: "Subscription Details",
      subscription,
    })
  } catch (error) {
    console.error("Subscription details error:", error)
    req.flash("error_msg", "Failed to load subscription details")
    res.redirect("/admin/subscriptions")
  }
})

// Create subscription manually (for admin)
router.post("/subscription/create", async (req, res) => {
  try {
    const { userId, plan, duration } = req.body

    // Validate user exists
    const user = await User.findById(userId)
    if (!user) {
      req.flash("error_msg", "User not found")
      return res.redirect("/admin/subscriptions")
    }

    if (!["monthly", "yearly"].includes(plan)) {
      req.flash("error_msg", "Invalid plan selected")
      return res.redirect("/admin/subscriptions")
    }

    // Calculate amount
    const amount = plan === "monthly" ? 9.99 : 99.99

    // Calculate expiration date
    const expiresAt = new Date()
    if (plan === "monthly") {
      expiresAt.setMonth(expiresAt.getMonth() + Number(duration) || 1)
    } else {
      expiresAt.setFullYear(expiresAt.getFullYear() + Number(duration) || 1)
    }

    // Create subscription
    const subscription = new Subscription({
      user: userId,
      plan,
      amount,
      status: "active",
      paymentMethod: "admin",
      paymentIntentId: "admin-" + Date.now(),
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
    await User.findByIdAndUpdate(userId, {
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

    req.flash("success_msg", `Successfully created ${plan} subscription for user`)
    res.redirect("/admin/subscriptions")
  } catch (error) {
    console.error("Create subscription error:", error)
    req.flash("error_msg", "Failed to create subscription")
    res.redirect("/admin/subscriptions")
  }
})

// Update subscription status
router.post("/subscription/:id/update", async (req, res) => {
  try {
    const { status } = req.body

    if (!["active", "cancelled", "expired"].includes(status)) {
      req.flash("error_msg", "Invalid status")
      return res.redirect(`/admin/subscription/${req.params.id}`)
    }

    const subscription = await Subscription.findById(req.params.id)

    if (!subscription) {
      req.flash("error_msg", "Subscription not found")
      return res.redirect("/admin/subscriptions")
    }

    // Update subscription status
    subscription.status = status
    if (status === "cancelled") {
      subscription.cancelledAt = new Date()
    }
    await subscription.save()

    // If status is changed to cancelled or expired, update user's premium status
    if (status === "cancelled" || status === "expired") {
      await User.findByIdAndUpdate(subscription.user, {
        isPremium: false,
        premiumTier: "none",
        premiumFeatures: {
          priorityService: false,
          tracking: false,
          discounts: 0,
          emergencyAssistance: false,
          freeTowing: 0,
          maintenanceChecks: false,
        },
      })
    }

    req.flash("success_msg", "Subscription status updated successfully")
    res.redirect(`/admin/subscription/${req.params.id}`)
  } catch (error) {
    console.error("Update subscription error:", error)
    req.flash("error_msg", "Failed to update subscription")
    res.redirect(`/admin/subscription/${req.params.id}`)
  }
})

// View premium users
router.get("/premium-users", async (req, res) => {
  try {
    const users = await User.find({ isPremium: true }).sort({ createdAt: -1 })

    res.render("admin/premium-users", {
      title: "Premium Users",
      users,
    })
  } catch (error) {
    console.error("Premium users error:", error)
    req.flash("error_msg", "Failed to load premium users")
    res.redirect("/admin/dashboard")
  }
})

// Other existing routes...

module.exports = router

