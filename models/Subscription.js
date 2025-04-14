const mongoose = require("mongoose")

const SubscriptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  plan: {
    type: String,
    enum: ["monthly", "yearly"],
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "active", "cancelled", "expired"],
    default: "pending",
  },
  amount: {
    type: Number,
    required: true,
  },
  paymentIntentId: {
    type: String,
  },
  paymentMethod: {
    type: String,
    enum: ["stripe", "cash", "admin"],
    default: "stripe",
  },
  startDate: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  cancelledAt: {
    type: Date,
  },
  renewalReminder: {
    type: Boolean,
    default: false,
  },
  features: {
    priorityService: { type: Boolean, default: true },
    tracking: { type: Boolean, default: true },
    discountPercentage: { type: Number, default: 10 }, // 10% for monthly, 15% for yearly
    emergencyAssistance: { type: Boolean, default: false }, // true for yearly only
    freeTowing: { type: Number, default: 0 }, // 0 for monthly, 2 for yearly
    maintenanceChecks: { type: Boolean, default: false }, // true for yearly only
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

// Add methods to check if subscription is active
SubscriptionSchema.methods.isActive = function () {
  return this.status === "active" && new Date(this.expiresAt) > new Date()
}

// Add middleware to update the user's premium status when subscription changes
SubscriptionSchema.post("save", async function (doc) {
  try {
    const User = mongoose.model("User")
    const user = await User.findById(doc.user)

    if (user) {
      // Update user's premium status based on subscription
      const isActive = doc.status === "active" && new Date(doc.expiresAt) > new Date()
      
      user.isPremium = isActive
      user.premiumTier = isActive ? doc.plan : "none"

      // Set premium features based on plan
      if (isActive) {
        user.premiumFeatures = {
          priorityService: true,
          tracking: true,
          discounts: doc.plan === "yearly" ? 15 : 10,
          emergencyAssistance: doc.plan === "yearly",
          freeTowing: doc.plan === "yearly" ? 2 : 0,
          maintenanceChecks: doc.plan === "yearly",
        }
      } else {
        user.premiumFeatures = {
          priorityService: false,
          tracking: false,
          discounts: 0,
          emergencyAssistance: false,
          freeTowing: 0,
          maintenanceChecks: false,
        }
      }

      await user.save()
    }
  } catch (error) {
    console.error("Error updating user premium status:", error)
  }
})

module.exports = mongoose.model("Subscription", SubscriptionSchema)
