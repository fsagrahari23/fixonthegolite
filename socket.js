const Chat = require("./models/Chat");
const User = require("./models/User");
const Booking = require("./models/Booking");

module.exports = (io) => {
  // Store online users
  const onlineUsers = {};

  io.on("connection", (socket) => {
    console.log("New client connected");

\
    socket.on("authenticate", async (userId) => {
      try {
        const user = await User.findById(userId);
        if (user) {
          socket.userId = userId;
          onlineUsers[userId] = socket.id;
          console.log(`User ${userId} authenticated`);

          // Notify relevant users that this user is online
          if (user.role === "mechanic") {
            // Find all bookings where this mechanic is assigned
            const bookings = await Booking.find({
              mechanic: userId,
              status: { $in: ["accepted", "in-progress"] },
            });

            // Notify all users with active bookings with this mechanic
            bookings.forEach((booking) => {
              if (onlineUsers[booking.user.toString()]) {
                io.to(onlineUsers[booking.user.toString()]).emit(
                  "mechanic-online",
                  {
                    mechanicId: userId,
                    bookingId: booking._id,
                  }
                );
              }
            });
          }
        }
      } catch (error) {
        console.error("Authentication error:", error);
      }
    });

    // Join a chat room
    socket.on("join-chat", async (chatId) => {
      try {
        const chat = await Chat.findById(chatId);
        if (chat && chat.participants.includes(socket.userId)) {
          socket.join(chatId);
          console.log(`User ${socket.userId} joined chat ${chatId}`);
        }
      } catch (error) {
        console.error("Join chat error:", error);
      }
    });

    // Send a message
    socket.on("send-message", async (data) => {
      try {
        const { chatId, content, attachments } = data;

        // Save message to database
        const chat = await Chat.findById(chatId);
        if (chat && chat.participants.includes(socket.userId)) {
          const newMessage = {
            sender: socket.userId,
            content,
            timestamp: new Date(),
            read: false,
            attachments: attachments || [],
          };

          chat.messages.push(newMessage);
          chat.lastActivity = new Date();
          chat.updatedAt = new Date();
          await chat.save();

          // Get sender info for the message
          const sender = await User.findById(socket.userId).select("name role");

          // Broadcast to all users in the chat room
          io.to(chatId).emit("new-message", {
            chatId,
            message: {
              ...newMessage,
              sender: {
                _id: socket.userId,
                name: sender.name,
                role: sender.role,
              },
            },
          });

          // Send notification to offline participants
          chat.participants.forEach((participantId) => {
            if (
              participantId.toString() !== socket.userId &&
              !onlineUsers[participantId.toString()]
            ) {
              // Here you would implement push notifications or other notification methods
              console.log(`Should notify offline user ${participantId}`);
            }
          });
        }
      } catch (error) {
        console.error("Send message error:", error);
      }
    });

    // Mark message as read
    socket.on("mark-read", async (data) => {
      try {
        const { chatId, messageId } = data;

        const chat = await Chat.findById(chatId);
        if (chat && chat.participants.includes(socket.userId)) {
          const message = chat.messages.id(messageId);
          if (
            message &&
            message.sender.toString() !== socket.userId &&
            !message.read
          ) {
            message.read = true;
            await chat.save();

            // Notify sender that message was read
            const senderId = message.sender.toString();
            if (onlineUsers[senderId]) {
              io.to(onlineUsers[senderId]).emit("message-read", {
                chatId,
                messageId,
              });
            }
          }
        }
      } catch (error) {
        console.error("Mark read error:", error);
      }
    });

    // Booking status updates
    socket.on("booking-update", async (data) => {
      try {
        const { bookingId, status } = data;
        const booking = await Booking.findById(bookingId);

        if (booking) {
          // Check if the user is authorized to update this booking
          if (
            (socket.userId === booking.user.toString() &&
              status === "cancelled") ||
            (socket.userId === booking.mechanic.toString() &&
              ["accepted", "in-progress", "completed"].includes(status)) ||
            (await User.findById(socket.userId)).role === "admin"
          ) {
            booking.status = status;
            booking.updatedAt = new Date();
            await booking.save();

            // Notify relevant users
            const notifyUsers = [booking.user.toString()];
            if (booking.mechanic) {
              notifyUsers.push(booking.mechanic.toString());
            }

            notifyUsers.forEach((userId) => {
              if (onlineUsers[userId]) {
                io.to(onlineUsers[userId]).emit("booking-status-changed", {
                  bookingId,
                  status,
                  updatedAt: booking.updatedAt,
                });
              }
            });
          }
        }
      } catch (error) {
        console.error("Booking update error:", error);
      }
    });

    // Towing status updates
    socket.on("towing-update", async (data) => {
      try {
        const { bookingId, status } = data;
        const booking = await Booking.findById(bookingId);

        if (booking && booking.requiresTowing) {
          // Check if the user is authorized to update towing status
          if (
            socket.userId === booking.mechanic.toString() ||
            (await User.findById(socket.userId)).role === "admin"
          ) {
            booking.towingDetails.status = status;
            booking.updatedAt = new Date();
            await booking.save();

            // Notify relevant users
            const notifyUsers = [booking.user.toString()];
            if (booking.mechanic) {
              notifyUsers.push(booking.mechanic.toString());
            }

            notifyUsers.forEach((userId) => {
              if (onlineUsers[userId]) {
                io.to(onlineUsers[userId]).emit("towing-status-changed", {
                  bookingId,
                  status,
                  updatedAt: booking.updatedAt,
                });
              }
            });
          }
        }
      } catch (error) {
        console.error("Towing update error:", error);
      }
    });

    // Mechanic location updates (for tracking)
    socket.on("update-location", async (data) => {
      try {
        const { coordinates } = data;
        if (socket.userId) {
          const user = await User.findById(socket.userId);
          if (user && user.role === "mechanic") {
            user.location.coordinates = coordinates;
            await user.save();

            // Find all active bookings for this mechanic
            const bookings = await Booking.find({
              mechanic: socket.userId,
              status: "in-progress",
            });

            // Notify users about mechanic location update
            bookings.forEach((booking) => {
              if (onlineUsers[booking.user.toString()]) {
                io.to(onlineUsers[booking.user.toString()]).emit(
                  "mechanic-location",
                  {
                    bookingId: booking._id,
                    mechanicId: socket.userId,
                    coordinates,
                  }
                );
              }
            });
          }
        }
      } catch (error) {
        console.error("Location update error:", error);
      }
    });

    // Disconnect
    socket.on("disconnect", () => {
      if (socket.userId) {
        delete onlineUsers[socket.userId];
        console.log(`User ${socket.userId} disconnected`);
      }
    });
  });
};
