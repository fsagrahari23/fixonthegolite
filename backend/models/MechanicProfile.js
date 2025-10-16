const mongoose = require("mongoose")

const MechanicProfileSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  specialization: {
    type: [String],
    required: true,
  },
  experience: {
    type: Number,
    required: true,
  },
  rating: {
    type: Number,
    default: 0,
  },
  reviews: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      rating: {
        type: Number,
        required: true,
      },
      comment: {
        type: String,
      },
      date: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  availability: {
    type: Boolean,
    default: true,
  },
  certifications: [
    {
      name: String,
      issuer: String,
      year: Number,
    },
  ],
  hourlyRate: {
    type: Number,
    required: true,
  },
  documents: [
    {
      type: String,
    },
  ],
})

module.exports = mongoose.model("MechanicProfile", MechanicProfileSchema)

