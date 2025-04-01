const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Booking = require("../models/Booking");
const Chat = require("../models/Chat");
const cloudinary = require("../config/cloudinary");
const MechanicProfile = require("../models/MechanicProfile"); // Import MechanicProfile

// User dashboard
router.get("/dashboard", async (req, res) => {
  try {
    // Get user's bookings
    const bookings = await Booking.find({ user: req.user._id })
      .populate("mechanic", "name phone")
      .sort({ createdAt: -1 });

    // Get stats
    const stats = {
      total: bookings.length,
      pending: bookings.filter((b) => b.status === "pending").length,
      inProgress: bookings.filter((b) => b.status === "in-progress").length,
      completed: bookings.filter((b) => b.status === "completed").length,
      cancelled: bookings.filter((b) => b.status === "cancelled").length,
    };

    // Get category-wise data
    const categories = {};
    bookings.forEach((booking) => {
      if (!categories[booking.problemCategory]) {
        categories[booking.problemCategory] = 0;
      }
      categories[booking.problemCategory]++;
    });

    res.render("user/dashboard", {
      title: "User Dashboard",
      user: req.user,
      bookings,
      stats,
      categories,
    });
  } catch (error) {
    console.error("User dashboard error:", error);
    req.flash("error_msg", "Failed to load dashboard");
    res.redirect("/");
  }
});

// New booking page
router.get("/book", (req, res) => {
  res.render("user/book", {
    title: "Book a Mechanic",
    user: req.user,
  });
});

// Create new booking
router.post("/book", async (req, res) => {
  try {
    const {
      problemCategory,
      description,
      address,
      latitude,
      longitude,
      requiresTowing,
      pickupAddress,
      pickupLatitude,
      pickupLongitude,
      dropoffAddress,
      dropoffLatitude,
      dropoffLongitude,
    } = req.body;

    // console.log(req.body);

    // Basic validation for main booking fields
    if (
      !problemCategory ||
      !description ||
      !address ||
      !latitude ||
      !longitude
    ) {
      req.flash("error_msg", "Please fill in all required fields");
      return res.redirect("/user/book");
    }

    // Parse coordinates for the main location
    const mainLongitude = Number.parseFloat(longitude);
    const mainLatitude = Number.parseFloat(latitude);

    // Upload images if provided
    const images = [];
    if (req.files && req.files.images) {
      if (Array.isArray(req.files.images)) {
        for (const file of req.files.images) {
          const result = await cloudinary.uploader.upload(file.tempFilePath);
          images.push(result.secure_url);
        }
      } else {
        const result = await cloudinary.uploader.upload(
          req.files.images.tempFilePath
        );
        images.push(result.secure_url);
      }
    }

    // Build the booking data with the main location
    const bookingData = {
      user: req.user._id,
      problemCategory,
      description,
      images,
      location: {
        type: "Point",
        coordinates: [mainLongitude, mainLatitude],
        address,
      },
      // Additional defaults like status and payment can be set in the schema
      requiresTowing:
        requiresTowing === "on" || requiresTowing === "true" ? true : false,
    };

    // If towing is required, validate and add towingDetails
    if (bookingData.requiresTowing) {
      if (!dropoffAddress || !dropoffLatitude || !dropoffLongitude) {
        req.flash(
          "error_msg",
          "Please provide dropoff location for towing service"
        );
        return res.redirect("/user/book");
      }

      // Parse towing coordinates; if pickup coordinates are not provided, fall back to main location
      const towPickupLongitude =
        Number.parseFloat(pickupLongitude) || mainLongitude;
      const towPickupLatitude =
        Number.parseFloat(pickupLatitude) || mainLatitude;
      const towDropoffLongitude = Number.parseFloat(dropoffLongitude);
      const towDropoffLatitude = Number.parseFloat(dropoffLatitude);

      bookingData.towingDetails = {
        pickupLocation: {
          type: "Point",
          coordinates: [towPickupLongitude, towPickupLatitude],
          address: pickupAddress || address,
        },
        dropoffLocation: {
          type: "Point",
          coordinates: [towDropoffLongitude, towDropoffLatitude],
          address: dropoffAddress,
        },
        status: "pending",
      };
    }

    const newBooking = new Booking(bookingData);
    await newBooking.save();

    req.flash("success_msg", "Booking created successfully");
    res.redirect(`/user/booking/${newBooking._id}`);
  } catch (error) {
    console.error("Create booking error:", error);
    req.flash("error_msg", "Failed to create booking");
    res.redirect("/user/book");
  }
});

// View booking details
router.get("/booking/:id", async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("mechanic", "name phone")
      .populate("user", "name phone");

    if (!booking) {
      req.flash("error_msg", "Booking not found");
      return res.redirect("/user/dashboard");
    }

    // Check if user is authorized to view this booking
    if (booking.user._id.toString() !== req.user._id.toString()) {
      req.flash("error_msg", "Not authorized");
      return res.redirect("/user/dashboard");
    }

    // Get nearby mechanics if booking is pending
    let nearbyMechanics = [];
    if (booking.status === "pending") {
      nearbyMechanics = await User.find({
        role: "mechanic",
        isApproved: true,
        location: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: booking.location.coordinates,
            },
            $maxDistance: 10000, // 10km
          },
        },
      }).limit(10);
    }

    // Get chat if exists
    const chat = await Chat.findOne({ booking: booking._id });

    res.render("user/booking-details", {
      title: "Booking Details",
      booking,
      nearbyMechanics,
      chat,
      user: req.user,
    });
  } catch (error) {
    console.error("View booking error:", error);
    req.flash("error_msg", "Failed to load booking details");
    res.redirect("/user/dashboard");
  }
});

// Select mechanic for booking
router.post("/booking/:id/select-mechanic", async (req, res) => {
  try {
    const { mechanicId } = req.body;

    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      req.flash("error_msg", "Booking not found");
      return res.redirect("/user/dashboard");
    }

    // Check if user is authorized
    if (booking.user.toString() !== req.user._id.toString()) {
      req.flash("error_msg", "Not authorized");
      return res.redirect("/user/dashboard");
    }

    // Check if booking is in pending state
    if (booking.status !== "pending") {
      req.flash("error_msg", "Booking is not in pending state");
      return res.redirect(`/user/booking/${booking._id}`);
    }

    // Update booking with selected mechanic
    booking.mechanic = mechanicId;
    await booking.save();

    // Create a chat for this booking
    const newChat = new Chat({
      booking: booking._id,
      participants: [req.user._id, mechanicId],
    });

    await newChat.save();

    req.flash("success_msg", "Mechanic selected successfully");
    res.redirect(`/user/booking/${booking._id}`);
  } catch (error) {
    console.error("Select mechanic error:", error);
    req.flash("error_msg", "Failed to select mechanic");
    res.redirect(`/user/booking/${req.params.id}`);
  }
});

// Cancel booking
router.post("/booking/:id/cancel", async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      req.flash("error_msg", "Booking not found");
      return res.redirect("/user/dashboard");
    }

    // Check if user is authorized
    if (booking.user.toString() !== req.user._id.toString()) {
      req.flash("error_msg", "Not authorized");
      return res.redirect("/user/dashboard");
    }

    // Check if booking can be cancelled
    if (!["pending", "accepted"].includes(booking.status)) {
      req.flash("error_msg", "Cannot cancel booking at this stage");
      return res.redirect(`/user/booking/${booking._id}`);
    }

    // Update booking status
    booking.status = "cancelled";
    booking.updatedAt = new Date();
    await booking.save();

    req.flash("success_msg", "Booking cancelled successfully");
    res.redirect("/user/dashboard");
  } catch (error) {
    console.error("Cancel booking error:", error);
    req.flash("error_msg", "Failed to cancel booking");
    res.redirect(`/user/booking/${req.params.id}`);
  }
});

// View booking history
router.get("/history", async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user._id })
      .populate("mechanic", "name")
      .sort({ createdAt: -1 });

    res.render("user/history", {
      title: "Booking History",
      bookings,
      user: req.user,
    });
  } catch (error) {
    console.error("Booking history error:", error);
    req.flash("error_msg", "Failed to load booking history");
    res.redirect("/user/dashboard");
  }
});

// Profile page
router.get("/profile", (req, res) => {
  res.render("user/profile", {
    title: "My Profile",
    user: req.user,
  });
});

// Update profile
router.post("/profile", async (req, res) => {
  try {
    const { name, phone, address, latitude, longitude } = req.body;

    // Validation
    if (!name || !phone || !address) {
      req.flash("error_msg", "Please fill in all fields");
      return res.redirect("/user/profile");
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

    req.flash("success_msg", "Profile updated successfully");
    res.redirect("/user/profile");
  } catch (error) {
    console.error("Update profile error:", error);
    req.flash("error_msg", "Failed to update profile");
    res.redirect("/user/profile");
  }
});

// Rate mechanic
router.post("/booking/:id/rate", async (req, res) => {
  try {
    const { rating, comment } = req.body;

    if (!rating) {
      return res
        .status(400)
        .json({ success: false, message: "Rating is required" });
    }

    const booking = await Booking.findById(req.params.id);

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

    // Check if booking is completed and paid
    if (
      booking.status !== "completed" ||
      booking.payment.status !== "completed"
    ) {
      return res.status(400).json({
        success: false,
        message: "Cannot rate until service is completed and paid",
      });
    }

    // Check if already rated
    if (booking.rating && booking.rating.value) {
      return res.status(400).json({
        success: false,
        message: "You have already rated this service",
      });
    }

    // Add rating to booking
    booking.rating = {
      value: Number.parseInt(rating),
      comment: comment,
      createdAt: new Date(),
    };

    await booking.save();

    // Update mechanic profile rating
    const mechanicProfile = await MechanicProfile.findOne({
      user: booking.mechanic,
    });

    if (mechanicProfile) {
      // Add the new review
      mechanicProfile.reviews.push({
        user: req.user._id,
        rating: Number.parseInt(rating),
        comment: comment,
        date: new Date(),
      });

      // Calculate new average rating
      const totalRating = mechanicProfile.reviews.reduce(
        (sum, review) => sum + review.rating,
        0
      );
      mechanicProfile.rating = totalRating / mechanicProfile.reviews.length;

      await mechanicProfile.save();
    }

    return res
      .status(200)
      .json({ success: true, message: "Rating submitted successfully" });
  } catch (error) {
    console.error("Rate mechanic error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
