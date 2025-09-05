# Bike Assistance System - Comprehensive Documentation

## Table of Contents
1. [Introduction](#introduction)
2. [Project Overview](#project-overview)
3. [Technologies Used](#technologies-used)
4. [Installation](#installation)
5. [Configuration](#configuration)
6. [Key Features](#key-features)
7. [Express.js Setup](#expressjs-setup)
8. [MongoDB and Mongoose](#mongodb-and-mongoose)
9. [Passport Authentication](#passport-authentication)
10. [Socket.io Real-time Features](#socketio-real-time-features)
11. [Cloudinary File Uploads](#cloudinary-file-uploads)
12. [Stripe Payment Processing](#stripe-payment-processing)
13. [EJS Templating Engine](#ejs-templating-engine)
14. [Geospatial Queries](#geospatial-queries)
15. [Session Management](#session-management)
16. [API Integration Examples](#api-integration-examples)
17. [Conclusion](#conclusion)

## Introduction

Welcome to the Bike Assistance System! This comprehensive documentation will guide you through understanding and working with this full-stack Node.js application. Whether you're a beginner learning web development or an experienced developer exploring new technologies, this guide will help you understand how various libraries and frameworks work together to create a robust bike assistance platform.

## Project Overview

The Bike Assistance System is a web application that connects bike owners with mechanics for on-demand repair services. The system includes:

- **User Registration and Authentication**: Users can register as customers or mechanics
- **Booking System**: Customers can book mechanic services
- **Real-time Chat**: Communication between users and mechanics
- **Location Services**: GPS-based mechanic tracking and location-based searches
- **Payment Processing**: Secure payments through Stripe
- **File Uploads**: Document verification for mechanics
- **Admin Dashboard**: System management and approval workflows

## Technologies Used

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: Passport.js with Local Strategy
- **Real-time Communication**: Socket.io
- **File Storage**: Cloudinary
- **Payment Processing**: Stripe
- **Templating**: EJS with Express EJS Layouts
- **Session Management**: express-session with connect-mongo
- **Geospatial Queries**: MongoDB 2dsphere indexes
- **Password Hashing**: bcryptjs
- **File Uploads**: express-fileupload

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd bike-assistance-system
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory with the following variables:
   ```env
   MONGODB_URI=mongodb://localhost:27017/bike-assistance
   SESSION_SECRET=your-session-secret
   CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
   CLOUDINARY_API_KEY=your-cloudinary-api-key
   CLOUDINARY_API_SECRET=your-cloudinary-api-secret
   STRIPE_SECRET_KEY=your-stripe-secret-key
   STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key
   PORT=3000
   ```

4. **Start MongoDB**
   Make sure MongoDB is running on your system.

5. **Run the application**
   ```bash
   npm start
   ```

## Configuration

### Environment Variables
The application uses environment variables for sensitive configuration:
- Database connection strings
- API keys for third-party services
- Session secrets
- Port configuration

### Database Configuration
MongoDB connection is established in `app.js`:
```javascript
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
```

## Key Features

- **Role-based Access Control**: User, Mechanic, and Admin roles
- **Real-time Updates**: Live booking status and chat
- **Location Tracking**: GPS-based mechanic location updates
- **Secure Payments**: Stripe integration with discount handling
- **File Management**: Cloudinary integration for document uploads
- **Geospatial Search**: Location-based mechanic discovery
- **Session Persistence**: MongoDB-backed session storage

## Express.js Setup

Express.js is the core web framework that handles HTTP requests, middleware, and routing.

### Basic Setup (from app.js)
```javascript
const express = require("express");
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// View engine setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Routes
app.use("/auth", authRoutes);
app.use("/user", isAuthenticated, isUser, userRoutes);

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### Key Concepts:
- **Middleware**: Functions that process requests before they reach route handlers
- **Routing**: Organizing endpoints by functionality (auth, user, mechanic, admin)
- **Static Files**: Serving CSS, JS, and images from the public directory
- **View Engine**: EJS for server-side rendering

## MongoDB and Mongoose

MongoDB is our NoSQL database, and Mongoose provides schema-based modeling.

### Connection Setup
```javascript
// In app.js
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("MongoDB connected"))
.catch((err) => console.error("MongoDB connection error:", err));
```

### User Schema Example (models/User.js)
```javascript
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["user", "mechanic", "admin"], default: "user" },
  location: {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], default: [77.209, 28.6139] },
  },
  // ... other fields
});

// Create geospatial index
UserSchema.index({ location: "2dsphere" });

// Password hashing middleware
UserSchema.pre("save", async function(next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Instance method
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};
```

### Key Concepts:
- **Schemas**: Define document structure and validation
- **Models**: Constructors for creating and querying documents
- **Middleware**: Pre/post hooks for operations
- **Indexes**: Improve query performance (especially geospatial)

## Passport Authentication

Passport.js handles user authentication with various strategies.

### Configuration (config/passport.js)
```javascript
const LocalStrategy = require("passport-local").Strategy;

module.exports = (passport) => {
  passport.use(
    new LocalStrategy({ usernameField: "email" }, async (email, password, done) => {
      const user = await User.findOne({ email });
      if (!user) return done(null, false, { message: "Email not registered" });

      const isMatch = await user.comparePassword(password);
      if (isMatch) return done(null, user);
      else return done(null, false, { message: "Password incorrect" });
    })
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id, done) => {
    const user = await User.findById(id);
    done(null, user);
  });
};
```

### Usage in Routes (routes/auth.js)
```javascript
router.post("/login", (req, res, next) => {
  passport.authenticate("local", {
    successRedirect: "/auth/redirect",
    failureRedirect: "/auth/login",
    failureFlash: true,
  })(req, res, next);
});
```

### Key Concepts:
- **Strategies**: Different authentication methods (local, OAuth, etc.)
- **Serialization**: Converting user object to session ID
- **Deserialization**: Converting session ID back to user object
- **Middleware**: Protecting routes with authentication checks

## Socket.io Real-time Features

Socket.io enables real-time bidirectional communication.

### Server Setup (socket.js)
```javascript
module.exports = (io) => {
  const onlineUsers = {};

  io.on("connection", (socket) => {
    // User authentication
    socket.on("authenticate", async (userId) => {
      socket.userId = userId;
      onlineUsers[userId] = socket.id;
    });

    // Real-time chat
    socket.on("send-message", async (data) => {
      const { chatId, content } = data;
      // Save to database and broadcast
      io.to(chatId).emit("new-message", { chatId, message });
    });

    // Booking status updates
    socket.on("booking-update", async (data) => {
      const { bookingId, status } = data;
      // Update database and notify users
      notifyUsers.forEach(userId => {
        if (onlineUsers[userId]) {
          io.to(onlineUsers[userId]).emit("booking-status-changed", { bookingId, status });
        }
      });
    });
  });
};
```

### Key Concepts:
- **Connection Management**: Tracking online users
- **Rooms**: Grouping sockets for targeted messaging
- **Events**: Custom events for different functionalities
- **Real-time Updates**: Instant notifications and status changes

## Cloudinary File Uploads

Cloudinary handles file storage and optimization.

### Configuration (config/cloudinary.js)
```javascript
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

module.exports = cloudinary;
```

### Usage in Routes (routes/auth.js)
```javascript
// Upload mechanic documents
const documents = [];
if (Array.isArray(req.files.documents)) {
  for (const file of req.files.documents) {
    const result = await cloudinary.uploader.upload(file.tempFilePath);
    documents.push(result.secure_url);
  }
}
```

### Key Concepts:
- **File Upload**: Handling multipart form data
- **Cloud Storage**: Secure file storage with CDN
- **Optimization**: Automatic image optimization and transformation
- **Security**: Secure URLs and access controls

## Stripe Payment Processing

Stripe handles secure payment processing.

### Payment Processing (routes/payment.js)
```javascript
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// Create payment intent
const paymentIntent = await stripe.paymentIntents.create({
  amount: Math.round(amountToCharge * 100), // Convert to cents
  currency: "usd",
  payment_method: paymentMethodId,
  confirm: true,
  description: `Payment for booking #${booking._id}`,
});
```

### Subscription Handling
```javascript
// Premium subscription payment
const paymentIntent = await stripe.paymentIntents.create({
  amount: plan === "monthly" ? 999 : 9999, // $9.99 or $99.99
  currency: "usd",
  payment_method: paymentMethodId,
  confirm: true,
  description: `Premium ${plan} subscription`,
});
```

### Key Concepts:
- **Payment Intents**: Secure payment flow
- **Currency Handling**: Amount conversion and formatting
- **Discounts**: Subscription-based pricing tiers
- **Webhooks**: Handling payment confirmations

## EJS Templating Engine

EJS renders dynamic HTML on the server.

### Setup in app.js
```javascript
const expressLayouts = require("express-ejs-layouts");

app.use(expressLayouts);
app.set("view engine", "ejs");
app.set("layout", "layout");
```

### Layout Template (views/layout.ejs)
```html
<!DOCTYPE html>
<html>
<head>
  <title><%= title %></title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <%- include('partials/navbar') %>
  <main>
    <%- body %>
  </main>
</body>
</html>
```

### Key Concepts:
- **Layouts**: Consistent page structure
- **Partials**: Reusable components
- **Server-side Rendering**: Dynamic content generation
- **Template Inheritance**: Extending base layouts

## Geospatial Queries

MongoDB's geospatial features enable location-based queries.

### Schema Setup (models/User.js)
```javascript
location: {
  type: { type: String, enum: ["Point"], default: "Point" },
  coordinates: { type: [Number], default: [77.209, 28.6139] },
}

// Create 2dsphere index
UserSchema.index({ location: "2dsphere" });
```

### Location-based Queries
```javascript
// Find nearby mechanics
const mechanics = await User.find({
  role: "mechanic",
  location: {
    $near: {
      $geometry: { type: "Point", coordinates: [longitude, latitude] },
      $maxDistance: 5000, // 5km radius
    },
  },
});
```

### Key Concepts:
- **2dsphere Index**: For accurate Earth-based calculations
- **GeoJSON**: Standard format for geospatial data
- **Distance Queries**: Finding nearby locations
- **Validation**: Ensuring valid coordinates

## Session Management

Express-session with MongoDB store for persistent sessions.

### Setup in app.js
```javascript
const session = require("express-session");
const MongoStore = require("connect-mongo");

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: { maxAge: 1000 * 60 * 60 * 24 }, // 1 day
}));
```

### Key Concepts:
- **Session Store**: Persistent storage in MongoDB
- **Security**: Secure session secrets and cookie options
- **Flash Messages**: Temporary messages across requests
- **User Context**: Storing user data in session

## API Integration Examples

### Authentication Flow
1. User submits login form
2. Passport authenticates credentials
3. Session created and stored in MongoDB
4. User redirected based on role

### Booking Flow
1. User creates booking request
2. System finds nearby mechanics using geospatial queries
3. Real-time notifications sent via Socket.io
4. Mechanic accepts and location tracking begins
5. Payment processed through Stripe upon completion

### File Upload Flow
1. Mechanic uploads certification documents
2. Files processed by express-fileupload
3. Uploaded to Cloudinary for storage
4. URLs stored in MongoDB
5. Admin reviews and approves mechanic account

## Conclusion

The Bike Assistance System demonstrates how multiple Node.js libraries can work together to create a comprehensive web application. Each technology serves a specific purpose:

- **Express.js**: Web framework and API routing
- **MongoDB/Mongoose**: Data storage and modeling
- **Passport**: User authentication
- **Socket.io**: Real-time communication
- **Cloudinary**: File management
- **Stripe**: Payment processing
- **EJS**: Template rendering
- **Geospatial Queries**: Location services
- **Session Management**: User state persistence

This modular approach allows for maintainable, scalable code where each library handles its specialty while integrating seamlessly with others. The documentation above provides practical examples from the actual codebase to help you understand both individual components and their interactions.

For further development or modifications, refer to the official documentation of each library and experiment with the provided code examples. Happy coding!
