const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const path = require("path");
const http = require("http");
const socketIo = require("socket.io");
const flash = require("connect-flash");
const methodOverride = require("method-override");
const passport = require("passport");
const fileUpload = require("express-fileupload");
const expressLayouts = require("express-ejs-layouts");
require("dotenv").config();

// Import routes
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const mechanicRoutes = require("./routes/mechanic");
const adminRoutes = require("./routes/admin");
const chatRoutes = require("./routes/chat");
const paymentRoutes = require("./routes/payment");

// Import middleware
const {
  isAuthenticated,
  isUser,
  isMechanic,
  isAdmin,
} = require("./middleware/auth");

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server);
// Make io available to routes via app.get('io')
app.set('io', io);

// Connect to MongoDB (driver v4+ no longer needs deprecated options)
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Set up session with MongoDB store
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 }, // 1 day
  })
);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: "/tmp/",
  })
);
app.use(express.static(path.join(__dirname, "public")));

app.use(express.static(path.join(__dirname, "uploads")));
app.set("views", path.join(__dirname, "views"));
app.use(flash());

app.use(expressLayouts);
app.use((req, res, next) => {
  res.locals.path = req.path; // This makes `path` available in all views
  next();
});

app.set("layout", "layout");

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());
require("./config/passport")(passport);

// Set global variables
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.success_msg = req.flash("success_msg");
  res.locals.error_msg = req.flash("error_msg");
  res.locals.error = req.flash("error");
  next();
});

// Set view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Routes
app.use("/auth", authRoutes);
app.use("/user", isAuthenticated, isUser, userRoutes);
app.use("/mechanic", isAuthenticated, isMechanic, mechanicRoutes);
app.use("/admin", isAuthenticated, isAdmin, adminRoutes);
app.use("/chat", isAuthenticated, chatRoutes);
app.use("/payment", isAuthenticated, paymentRoutes);

// Home route
app.get("/", (req, res) => {
  res.render("index", { title: "Bike Assistance System", layout: false });
});

// Socket.io setup
require("./socket")(io);


// Start server
const PORT =  process.env.PORT || 3001;
server.listen(PORT, () => {

  console.log(`Server running on http://localhost:${PORT}`);
});
