module.exports = {
  isAuthenticated: (req, res, next) => {
    if (req.isAuthenticated()) {
      return next()
    }
    req.flash("error_msg", "Please log in to access this resource")
    res.redirect("/auth/login")
  },

  isUser: (req, res, next) => {
    if (req.user && req.user.role === "user") {
      return next()
    }
    req.flash("error_msg", "Not authorized as a user")
    res.redirect("/")
  },

  isMechanic: (req, res, next) => {
    if (req.user && req.user.role === "mechanic") {
      if (!req.user.isApproved) {
        req.flash("error_msg", "Your account is pending approval by admin")
        return res.redirect("/auth/pending-approval")
      }
      return next()
    }
    req.flash("error_msg", "Not authorized as a mechanic")
    res.redirect("/")
  },

  isAdmin: (req, res, next) => {
    if (req.user && req.user.role === "admin") {
      return next()
    }
    req.flash("error_msg", "Not authorized as an admin")
    res.redirect("/")
  },
}

