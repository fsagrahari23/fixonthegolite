const mongoose = require("mongoose")

const BookingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  mechanic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  problemCategory: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  images: [String],
  location: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
    },
    coordinates: {
      type: [Number],
      default: [77.209, 28.6139], // Default to Delhi coordinates if not provided
      validate: {
        validator: (v) => {
          // Validate that coordinates are not [0, 0]
          return !(v[0] === 0 && v[1] === 0)
        },
        message: "Invalid coordinates. Cannot be [0, 0].",
      },
    },
    address: String,
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "in-progress", "completed", "cancelled"],
    default: "pending",
  },
  payment: {
    status: {
      type: String,
      enum: ["pending", "completed", "refunded"],
      default: "pending",
    },
    amount: {
      type: Number,
      default: 0,
    },
    transactionId: String,
  },
  requiresTowing: {
    type: Boolean,
    default: false,
  },
  towingDetails: {
    pickupLocation: String,
    dropoffLocation: String,
    status: {
      type: String,
      enum: ["pending", "in-progress", "completed"],
      default: "pending",
    },
  },
  rating: {
    value: {
      type: Number,
      min: 1,
      max: 5,
    },
    review: String,
    date: Date,
  },
  isPriority: {
    type: Boolean,
    default: false,
  },
  premiumDiscount: {
    isApplied: {
      type: Boolean,
      default: false,
    },
    rate: {
      type: Number,
      default: 0,
    },
    plan: {
      type: String,
      enum: ["monthly", "yearly"],
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
})

// Create a 2dsphere index for location
BookingSchema.index({ location: "2dsphere" })

module.exports = mongoose.model("Booking", BookingSchema)
