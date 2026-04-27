const mongoose = require("mongoose");

const messageModel = mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    content: { type: String, trim: true, default: "" },
    chat: { type: mongoose.Schema.Types.ObjectId, ref: "Chat" },
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null },
    fileUrl: { type: String, default: null },
    fileType: { type: String, enum: ["image", "file"] },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    reactions: [
      {
        emoji: { type: String },
        users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      },
    ],
    isDeleted: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
    editHistory: [
      {
        content: { type: String },
        editedAt: { type: Date },
      },
    ],
  },
  { timestamps: true }
);

messageModel.index({ chat: 1 });
messageModel.index({ chat: 1, createdAt: -1 });
messageModel.index({ content: "text" });

const Message = mongoose.model("Message", messageModel);

module.exports = Message;
