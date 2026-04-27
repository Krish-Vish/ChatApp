const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const Chat = require("../models/chatmodel");
const Message = require("../models/messageModel");
const User = require("../models/userModel");

const fetchPopulated = async (messageId) => {
  let msg = await Message.findById(messageId)
    .populate("sender", "name pic")
    .populate({
      path: "replyTo",
      select: "content sender fileType fileUrl",
      populate: { path: "sender", select: "name" },
    })
    .populate("chat");
  msg = await User.populate(msg, {
    path: "chat.users",
    select: "name pic email",
  });
  return msg;
};

const sendMessage = asyncHandler(async (req, res) => {
  const { content, chatId, replyTo, fileUrl, fileType } = req.body;

  if (!chatId) {
    return res.status(400).json({ message: "chatId is required" });
  }
  if (!content && !fileUrl) {
    return res.status(400).json({ message: "content or fileUrl is required" });
  }

  const newMessage = {
    sender: req.user._id,
    content: content || "",
    chat: chatId,
    readBy: [req.user._id],
  };

  if (replyTo && mongoose.Types.ObjectId.isValid(replyTo)) {
    newMessage.replyTo = replyTo;
  }
  if (fileUrl) {
    newMessage.fileUrl = fileUrl;
    newMessage.fileType = fileType === "image" ? "image" : "file";
  }

  try {
    const created = await Message.create(newMessage);
    const message = await fetchPopulated(created._id);
    await Chat.findByIdAndUpdate(chatId, { latestMessage: created._id });
    res.json(message);
  } catch (error) {
    console.error("sendMessage error:", error.message);
    res.status(400);
    throw new Error(error.message);
  }
});

const allMessages = asyncHandler(async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const query = { chat: req.params.chatId };

    if (req.query.before && mongoose.Types.ObjectId.isValid(req.query.before)) {
      const ref = await Message.findById(req.query.before).select("createdAt").lean();
      if (ref) query.createdAt = { $lt: ref.createdAt };
    }

    const messages = await Message.find(query)
      .populate("sender", "name pic email")
      .populate({
        path: "replyTo",
        select: "content sender fileType fileUrl",
        populate: { path: "sender", select: "name" },
      })
      .populate("chat")
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json(messages.reverse());
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

const reactToMessage = asyncHandler(async (req, res) => {
  const { emoji } = req.body;
  if (!emoji) return res.sendStatus(400);

  const message = await Message.findById(req.params.messageId);
  if (!message) { res.status(404); throw new Error("Message not found"); }

  const reactionIndex = message.reactions.findIndex((r) => r.emoji === emoji);

  if (reactionIndex === -1) {
    message.reactions.push({ emoji, users: [req.user._id] });
  } else {
    const reaction = message.reactions[reactionIndex];
    const hasReacted = reaction.users.some(
      (u) => u.toString() === req.user._id.toString()
    );
    if (hasReacted) {
      reaction.users = reaction.users.filter(
        (u) => u.toString() !== req.user._id.toString()
      );
      if (reaction.users.length === 0) message.reactions.splice(reactionIndex, 1);
    } else {
      reaction.users.push(req.user._id);
    }
  }

  await message.save();
  res.json(await fetchPopulated(message._id));
});

const markMessagesRead = asyncHandler(async (req, res) => {
  const { chatId } = req.body;
  if (!chatId) return res.sendStatus(400);

  await Message.updateMany(
    { chat: chatId, readBy: { $ne: req.user._id } },
    { $addToSet: { readBy: req.user._id } }
  );

  res.json({ message: "ok" });
});

const editMessage = asyncHandler(async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) { res.status(400); throw new Error("Content required"); }

  const message = await Message.findById(req.params.messageId);
  if (!message) { res.status(404); throw new Error("Message not found"); }
  if (message.sender.toString() !== req.user._id.toString()) {
    res.status(403); throw new Error("Not authorized");
  }
  if (message.isDeleted) { res.status(400); throw new Error("Cannot edit a deleted message"); }

  message.editHistory.push({ content: message.content, editedAt: message.updatedAt });
  message.content = content.trim();
  message.editedAt = new Date();
  await message.save();

  res.json(await fetchPopulated(message._id));
});

const deleteMessage = asyncHandler(async (req, res) => {
  const message = await Message.findById(req.params.messageId);
  if (!message) { res.status(404); throw new Error("Message not found"); }
  if (message.sender.toString() !== req.user._id.toString()) {
    res.status(403); throw new Error("Not authorized");
  }

  message.isDeleted = true;
  message.content = "";
  message.fileUrl = undefined;
  message.fileType = undefined;
  await message.save();

  res.json(await fetchPopulated(message._id));
});

const searchMessages = asyncHandler(async (req, res) => {
  const { chatId, q } = req.query;
  if (!q?.trim() || !chatId) return res.sendStatus(400);

  const chat = await Chat.findOne({ _id: chatId, users: req.user._id });
  if (!chat) { res.status(403); throw new Error("Not authorized"); }

  const messages = await Message.find(
    {
      chat: chatId,
      isDeleted: { $ne: true },
      $text: { $search: q.trim() },
    },
    { score: { $meta: "textScore" } }
  )
    .populate("sender", "name pic")
    .select("content sender createdAt editedAt fileType")
    .sort({ score: { $meta: "textScore" }, createdAt: -1 })
    .limit(20);

  res.json(messages);
});

module.exports = {
  sendMessage,
  allMessages,
  reactToMessage,
  markMessagesRead,
  editMessage,
  deleteMessage,
  searchMessages,
};
