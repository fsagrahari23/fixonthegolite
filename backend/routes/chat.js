const express = require("express");
const router = express.Router();
const Chat = require("../models/Chat");
const Booking = require("../models/Booking");
const cloudinary = require("../config/cloudinary");

// Get chat for a booking
router.get("/:bookingId", async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId)
      .populate("user", "name")
      .populate("mechanic", "name");

    if (!booking) {
      req.flash("error_msg", "Booking not found");
      return res.redirect("/");
    }

    // Check if user is authorized to view this chat
    if (
      booking.user._id.toString() !== req.user._id.toString() &&
      booking.mechanic &&
      booking.mechanic._id.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      req.flash("error_msg", "Not authorized");
      return res.redirect("/");
    }

    // Get or create chat
    let chat = await Chat.findOne({ booking: booking._id });
    console.log("Chat found:", chat);
    // console.lof(user);
    if (!chat) {
      chat = await Chat.findOne({
        participants: {
          $all: [
            booking.user._id,
            booking.mechanic ? booking.mechanic._id : null,
          ],
        },
      });
    }
    console.log(booking.mechanic, booking.user._id);
    if (!chat && booking.mechanic) {
      chat = new Chat({
        booking: booking._id,
        participants: [booking.user._id, booking.mechanic._id],
      });
      await chat.save();
    }

    if (!chat) {
      req.flash("error_msg", "Chat not available yet");
      return res.redirect("/");
    }
    console.log("Chat found or created:", chat);
    // Mark messages as read
    if (chat.messages.length > 0) {
      let updated = false;
      chat.messages.forEach((message) => {
        if (
          message.sender.toString() !== req.user._id.toString() &&
          !message.read
        ) {
          message.read = true;
          updated = true;
        }
      });

      if (updated) {
        await chat.save();
      }
    }

    res.render("chat/index", {
      title: "Chat",
      booking,
      chat,
      user: req.user,
    });
  } catch (error) {
    console.error("Chat error:", error);
    req.flash("error_msg", "Failed to load chat");
    res.redirect("/");
  }
});

// Send message API
router.post("/:chatId/send", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message && (!req.files || !req.files.attachment)) {
      return res
        .status(400)
        .json({ success: false, message: "Message or attachment is required" });
    }

    const chat = await Chat.findById(req.params.chatId);

    if (!chat) {
      return res
        .status(404)
        .json({ success: false, message: "Chat not found" });
    }

    // Check if user is a participant
    if (!chat.participants.includes(req.user._id)) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    // Process attachment if any
    const attachments = [];
    if (req.files && req.files.attachment) {
      if (Array.isArray(req.files.attachment)) {
        // Multiple attachments
        for (const file of req.files.attachment) {
          const result = await cloudinary.uploader.upload(file.tempFilePath, {
            resource_type: "auto",
          });
          attachments.push({
            type: result.secure_url,
            contentType: file.mimetype,
          });
        }
      } else {
        // Single attachment
        const result = await cloudinary.uploader.upload(
          req.files.attachment.tempFilePath,
          {
            resource_type: "auto",
          }
        );
        attachments.push({
          type: result.secure_url,
          contentType: req.files.attachment.mimetype,
        });
      }
    }

    // Add message
    chat.messages.push({
      sender: req.user._id,
      content: message || "Sent an attachment",
      timestamp: new Date(),
      read: false,
      attachments: attachments,
    });

    chat.lastActivity = new Date();
    chat.updatedAt = new Date();
    await chat.save();

    return res.status(200).json({ success: true, message: "Message sent" });
  } catch (error) {
    console.error("Send message error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get messages API
router.get("/:chatId/messages", async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId).populate(
      "messages.sender",
      "name role"
    );

    if (!chat) {
      return res
        .status(404)
        .json({ success: false, message: "Chat not found" });
    }

    // Check if user is a participant
    if (!chat.participants.includes(req.user._id)) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    // Mark messages as read
    let updated = false;
    chat.messages.forEach((message) => {
      if (
        message.sender._id.toString() !== req.user._id.toString() &&
        !message.read
      ) {
        message.read = true;
        updated = true;
      }
    });

    if (updated) {
      await chat.save();
    }

    return res.status(200).json({ success: true, messages: chat.messages });
  } catch (error) {
    console.error("Get messages error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get unread message count
router.get("/unread/count", async (req, res) => {
  try {
    // Find all chats where the user is a participant
    const chats = await Chat.find({
      participants: req.user._id,
    });

    let unreadCount = 0;

    // Count unread messages in each chat
    chats.forEach((chat) => {
      chat.messages.forEach((message) => {
        if (
          message.sender.toString() !== req.user._id.toString() &&
          !message.read
        ) {
          unreadCount++;
        }
      });
    });

    return res.status(200).json({ success: true, unreadCount });
  } catch (error) {
    console.error("Get unread count error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
