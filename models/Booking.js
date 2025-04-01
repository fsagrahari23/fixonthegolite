const mongoose = require("mongoose");

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
  images: [
    {
      type: String,
    },
  ],
  location: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: function (v) {
          // Validate that coordinates are not [0, 0] and are within valid ranges
          return (
            Array.isArray(v) &&
            v.length === 2 &&
            !(v[0] === 0 && v[1] === 0) &&
            v[0] >= -180 &&
            v[0] <= 180 &&
            v[1] >= -90 &&
            v[1] <= 90
          );
        },
        message:
          "Invalid coordinates. Longitude must be between -180 and 180, latitude between -90 and 90, and not [0, 0].",
      },
    },
    address: {
      type: String,
      required: true,
    },
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "in-progress", "completed", "cancelled"],
    default: "pending",
  },
  payment: {
    amount: {
      type: Number,
    },
    status: {
      type: String,
      enum: ["pending", "completed"],
      default: "pending",
    },
    transactionId: {
      type: String,
    },
  },
  notes: {
    type: String,
  },
  requiresTowing: {
    type: Boolean,
    default: false,
  },
  towingDetails: {
    pickupLocation: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        required: function () {
          // Only require pickup coordinates if towing is needed
          return this.requiresTowing;
        },
        validate: {
          validator: function (v) {
            // Skip validation if towing is not required or value is not provided
            if (!this.requiresTowing || !v) return true;
            return (
              Array.isArray(v) &&
              v.length === 2 &&
              !(v[0] === 0 && v[1] === 0) &&
              v[0] >= -180 &&
              v[0] <= 180 &&
              v[1] >= -90 &&
              v[1] <= 90
            );
          },
          message:
            "Invalid pickup coordinates. Longitude must be between -180 and 180, latitude between -90 and 90, and not [0, 0].",
        },
      },
      address: {
        type: String,
      },
    },
    dropoffLocation: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        required: function () {
          // Only require dropoff coordinates if towing is needed
          return this.requiresTowing;
        },
        validate: {
          validator: function (v) {
            // Skip validation if towing is not required or value is not provided
            if (!this.requiresTowing || !v) return true;
            return (
              Array.isArray(v) &&
              v.length === 2 &&
              !(v[0] === 0 && v[1] === 0) &&
              v[0] >= -180 &&
              v[0] <= 180 &&
              v[1] >= -90 &&
              v[1] <= 90
            );
          },
          message:
            "Invalid dropoff coordinates. Longitude must be between -180 and 180, latitude between -90 and 90, and not [0, 0].",
        },
      },
      address: {
        type: String,
      },
    },
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
    comment: {
      type: String,
    },
    createdAt: {
      type: Date,
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
});

// Geospatial indexes (only if you plan on doing geo queries)
BookingSchema.index({ location: "2dsphere" });
BookingSchema.index({ "towingDetails.pickupLocation": "2dsphere" });
BookingSchema.index({ "towingDetails.dropoffLocation": "2dsphere" });

module.exports = mongoose.model("Booking", BookingSchema);
