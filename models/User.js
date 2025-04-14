const mongoose = require("mongoose")
const bcrypt = require("bcryptjs")

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
  },
  role: {
    type: String,
    enum: ["user", "mechanic", "admin"],
    default: "user",
  },
  profileImage: {
    type: String,
    default: "",
  },
  isPremium: {
    type: Boolean,
    default: false,
  },
  premiumTier: {
    type: String,
    enum: ["none", "monthly", "yearly"],
    default: "none",
  },
  basicBookingsUsed: {
    type: Number,
    default: 0,
  },
  location: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
    },
    coordinates: {
      type: [Number],
      default: [77.209, 28.6139], // Default to Delhi coordinates
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
  isVerified: {
    type: Boolean,
    default: false,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  premiumFeatures: {
    priorityService: { type: Boolean, default: false },
    tracking: { type: Boolean, default: false },
    discounts: { type: Number, default: 0 }, // Percentage discount
    emergencyAssistance: { type: Boolean, default: false },
    freeTowing: { type: Number, default: 0 }, // Number of free towing services
    maintenanceChecks: { type: Boolean, default: false },
  },
})

// Create a 2dsphere index for location
UserSchema.index({ location: "2dsphere" })

// Password hashing middleware
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next()
  }
  try {
    const salt = await bcrypt.genSalt(10)
    this.password = await bcrypt.hash(this.password, salt)
    next()
  } catch (error) {
    next(error)
  }
})

// Method to compare passwords
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password)
}

module.exports = mongoose.model("User", UserSchema)
