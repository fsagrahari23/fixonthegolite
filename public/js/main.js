document.addEventListener("DOMContentLoaded", () => {
  // Initialize socket connection if user is logged in
  if (document.body.dataset.userId) {
    initializeSocket(document.body.dataset.userId);
  }

  // Initialize map if map container exists
  const mapContainer = document.getElementById("map");
  if (mapContainer) {
    initializeMap(mapContainer);
  }

  // Initialize chat if chat container exists
  const chatContainer = document.getElementById("chat-container");
  if (chatContainer) {
    initializeChat(chatContainer.dataset.chatId);
  }

  // Initialize booking status updates
  const bookingStatusBtns = document.querySelectorAll(".booking-status-btn");
  if (bookingStatusBtns.length > 0) {
    bookingStatusBtns.forEach((btn) => {
      btn.addEventListener("click", function () {
        updateBookingStatus(this.dataset.bookingId, this.dataset.status);
      });
    });
  }

  // Initialize payment form if it exists
  const paymentForm = document.getElementById("payment-form");
  if (paymentForm) {
    initializePaymentForm(paymentForm);
  }
  // Initialize rating form if it exists
  const ratingForm = document.getElementById("rating-form");
  if (ratingForm) {
    initializeRatingForm(ratingForm);
  }

  // Check for unread messages
  checkUnreadMessages();

  // Set interval to check for unread messages every minute
  setInterval(checkUnreadMessages, 60000);
});

// Socket.io initialization
function initializeSocket(userId) {
  const socket = io();

  // Authenticate with socket
  socket.emit("authenticate", userId);

  // Listen for booking status changes
  socket.on("booking-status-changed", (data) => {
    const statusElement = document.getElementById(
      `booking-status-${data.bookingId}`
    );
    if (statusElement) {
      statusElement.textContent = data.status;
      statusElement.className = `booking-status status-${data.status}`;

      // Show notification
      showNotification(`Booking status updated to ${data.status}`);

      // Reload page if needed
      if (window.location.pathname.includes(data.bookingId)) {
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    }
  });

  // Listen for new messages
  socket.on("new-message", (data) => {
    const chatContainer = document.getElementById("chat-messages");
    if (chatContainer && chatContainer.dataset.chatId === data.chatId) {
      appendMessage(chatContainer, data.message);
      chatContainer.scrollTop = chatContainer.scrollHeight;

      // Play notification sound
      const notificationSound = document.getElementById("notification-sound");
      if (notificationSound) {
        notificationSound.play();
      }
      // Mark message as read
      markMessageAsRead(data.chatId, data.message._id);
    } else {
      // Show notification for new message
      showNotification("You have a new message");
      checkUnreadMessages();
    }
  });

  // Listen for mechanic location updates
  socket.on("mechanic-location", (data) => {
    const map = window.bookingMap;
    if (map && window.mechanicMarker) {
      const newLatLng = [data.coordinates[1], data.coordinates[0]];
      window.mechanicMarker.setLatLng(newLatLng);
      map.panTo(newLatLng);

      // Update ETA if distance function is available
      if (window.userLocation && typeof calculateDistance === "function") {
        const distance = calculateDistance(
          window.userLocation[0],
          window.userLocation[1],
          data.coordinates[1],
          data.coordinates[0]
        );
        const eta = Math.round((distance / 30) * 60); // Assuming 30 km/h speed
        document.getElementById(
          "mechanic-eta"
        ).textContent = `ETA: ${eta} minutes`;
      }
    }
  });

  // Make socket globally available
  window.socket = socket;

  return socket;
}

// Initialize chat functionality
function initializeChat(chatId) {
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");
  const chatMessages = document.getElementById("chat-messages");

  // Join chat room
  if (window.socket) {
    window.socket.emit("join-chat", chatId);
  }

  // Load initial messages

  // Handle form submission
  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const message = chatInput.value.trim();
    if (!message) return;

    // Send message to server
    fetch(`/chat/${chatId}/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          chatInput.value = "";
        } else {
          showNotification(data.message, "danger");
        }
      })
      .catch((error) => {
        console.error("Error sending message:", error);
        showNotification("Failed to send message", "danger");
      });
  });

  // Auto-scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Load chat messages
function loadMessages(chatId) {
  const chatMessages = document.getElementById("chat-messages");

  fetch(`/chat/${chatId}/messages`)
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        chatMessages.innerHTML = "";
        data.messages.forEach((message) => {
          appendMessage(chatMessages, message);
        });
        chatMessages.scrollTop = chatMessages.scrollHeight;
      } else {
        showNotification(data.message, "danger");
      }
    })
    .catch((error) => {
      console.error("Error loading messages:", error);
      showNotification("Failed to load messages", "danger");
    });
}

// Append message to chat container
function appendMessage(container, message) {
  const messageDiv = document.createElement("div");
  messageDiv.className = `chat-message ${
    message.sender._id === document.body.dataset.userId ? "sent" : "received"
  }`;
  messageDiv.dataset.id = message._id;

  const senderName = document.createElement("div");
  senderName.className = "sender-name";
  senderName.textContent =
    message.sender._id === document.body.dataset.userId
      ? "You"
      : message.sender.name;

  const messageContent = document.createElement("div");
  messageContent.className = "message-content";
  messageContent.textContent = message.content;

  // Add attachments if any
  if (message.attachments && message.attachments.length > 0) {
    const attachmentsDiv = document.createElement("div");
    attachmentsDiv.className = "message-attachments";

    message.attachments.forEach((attachment) => {
      if (
        attachment.contentType &&
        attachment.contentType.startsWith("image/")
      ) {
        const imgLink = document.createElement("a");
        imgLink.href = attachment.type;
        imgLink.target = "_blank";
        imgLink.className = "attachment-thumbnail";

        const img = document.createElement("img");
        img.src = attachment.type;
        img.alt = "Attachment";

        imgLink.appendChild(img);
        attachmentsDiv.appendChild(imgLink);
      } else {
        const fileLink = document.createElement("a");
        fileLink.href = attachment.type;
        fileLink.target = "_blank";
        fileLink.className = "attachment-file";

        const icon = document.createElement("i");
        icon.className = "fas fa-file-alt";

        fileLink.appendChild(icon);
        fileLink.appendChild(document.createTextNode(" Attachment"));
        attachmentsDiv.appendChild(fileLink);
      }
    });

    messageDiv.appendChild(attachmentsDiv);
  }

  const messageTime = document.createElement("div");
  messageTime.className = "message-time";

  const timeText = document.createTextNode(
    new Date(message.timestamp).toLocaleTimeString()
  );
  messageTime.appendChild(timeText);

  // Add read indicator for sent messages
  if (message.sender._id === document.body.dataset.userId && message.read) {
    const readIndicator = document.createElement("span");
    readIndicator.className = "text-primary ms-1";
    readIndicator.title = "Read";

    const icon = document.createElement("i");
    icon.className = "fas fa-check-double";

    readIndicator.appendChild(icon);
    messageTime.appendChild(readIndicator);
  }

  messageDiv.appendChild(senderName);
  messageDiv.appendChild(messageContent);
  messageDiv.appendChild(messageTime);

  container.appendChild(messageDiv);
}

// Update booking status
function updateBookingStatus(bookingId, status) {
  if (window.socket) {
    window.socket.emit("booking-update", { bookingId, status });
    showNotification(`Updating booking status to ${status}...`);
  } else {
    showNotification("Socket connection not available", "danger");
  }
}

// Initialize map
function initializeMap(container) {
  // This is a placeholder for map initialization
  // In a real application, you would use a mapping library like Leaflet or Google Maps
  console.log("Map initialization would happen here");
}
function markMessageAsRead(chatId, messageId) {
  // This would be implemented with a socket event or API call
  if (window.socket) {
    window.socket.emit("mark-read", { chatId, messageId });
  }
}

// Check for unread messages
function checkUnreadMessages() {
  if (!document.body.dataset.userId) return;

  fetch("/chat/unread/count")
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        updateUnreadBadge(data.unreadCount);
      }
    })
    .catch((error) => {
      console.error("Error checking unread messages:", error);
    });
}

// Update unread message badge
function updateUnreadBadge(count) {
  const badge = document.getElementById("unread-message-badge");

  if (badge) {
    if (count > 0) {
      badge.textContent = count;
      badge.classList.remove("d-none");
    } else {
      badge.classList.add("d-none");
    }
  }
}

// Initialize payment form
function initializePaymentForm(form) {
  const stripe = Stripe(form.dataset.stripeKey);
  const elements = stripe.elements();

  // Create card element
  const card = elements.create("card");
  card.mount("#card-element");

  // Handle form submission
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = "Processing...";

    try {
      const { paymentMethod, error } = await stripe.createPaymentMethod({
        type: "card",
        card,
      });

      if (error) {
        throw new Error(error.message);
      }

      // Process payment on server
      const response = await fetch(
        `/payment/${form.dataset.bookingId}/process`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ paymentMethodId: paymentMethod.id }),
        }
      );

      const data = await response.json();

      if (data.success) {
        showNotification("Payment successful!", "success");
        setTimeout(() => {
          window.location.href = `/user/booking/${form.dataset.bookingId}`;
        }, 2000);
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error("Payment error:", error);
      showNotification(error.message, "danger");
      submitButton.disabled = false;
      submitButton.textContent = "Pay Now";
    }
  });
}

// Initialize rating form
function initializeRatingForm(form) {
  const ratingInputs = form.querySelectorAll('input[name="rating"]');
  const ratingStars = form.querySelectorAll(".rating-star");

  // Handle star hover
  ratingStars.forEach((star, index) => {
    star.addEventListener("mouseenter", () => {
      // Highlight stars up to the hovered one
      for (let i = 0; i <= index; i++) {
        ratingStars[i].classList.add("hovered");
      }
    });

    star.addEventListener("mouseleave", () => {
      // Remove highlight on mouse leave
      ratingStars.forEach((s) => s.classList.remove("hovered"));
    });

    star.addEventListener("click", () => {
      // Set the rating value
      ratingInputs[index].checked = true;

      // Update visual state
      ratingStars.forEach((s, i) => {
        if (i <= index) {
          s.classList.add("selected");
        } else {
          s.classList.remove("selected");
        }
      });
    });
  });

  // Handle form submission
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Submitting...';

    const formData = new FormData(form);

    try {
      const response = await fetch(form.action, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        showNotification("Rating submitted successfully!", "success");
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error("Rating error:", error);
      showNotification(error.message || "Failed to submit rating", "danger");
      submitButton.disabled = false;
      submitButton.innerHTML = "Submit Rating";
    }
  });
}
// Show notification
function showNotification(message, type = "info") {
  const notificationContainer = document.getElementById(
    "notification-container"
  );
  if (!notificationContainer) {
    const container = document.createElement("div");
    container.id = "notification-container";
    container.style.position = "fixed";
    container.style.top = "20px";
    container.style.right = "20px";
    container.style.zIndex = "9999";
    document.body.appendChild(container);
  }

  const notification = document.createElement("div");
  notification.className = `alert alert-${type} alert-dismissible fade show`;
  notification.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;

  document.getElementById("notification-container").appendChild(notification);

  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    notification.classList.remove("show");
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 5000);
}

// Calculate distance between two points (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in km
  return distance;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}
