const express = require("express");
const {
  sendMessage,
  allMessages,
  reactToMessage,
  markMessagesRead,
  editMessage,
  deleteMessage,
  searchMessages,
} = require("../controllers/messageControllers");
const { protect } = require("../middlewares/authMiddleware");
const { messageLimiter } = require("../middlewares/rateLimiters");

const router = express.Router();

// static before /:params
router.route("/").post(protect, messageLimiter, sendMessage);
router.route("/markread").put(protect, markMessagesRead);
router.route("/search").get(protect, searchMessages);
router.route("/:chatId").get(protect, allMessages);
router.route("/:messageId/react").put(protect, reactToMessage);
router.route("/:messageId")
  .patch(protect, editMessage)
  .delete(protect, deleteMessage);

module.exports = router;
