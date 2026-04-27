const express = require("express");
const connectDB = require("./config/db");
const dotenv = require("dotenv");
const userRoutes = require("./routes/userRoutes");
const chatRoutes = require("./routes/chatRoutes");
const messageRoutes = require("./routes/messageRoutes");
const cookieParser = require("cookie-parser");
const { notFound, errorHandler } = require("./middlewares/errorMiddleware");
const { apiLimiter } = require("./middlewares/rateLimiters");
const path = require("path");
dotenv.config();
connectDB();
const app = express();

app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

// must be before routes
const allowedOrigin = process.env.FRONTEND_URL || "http://localhost:3000";
app.use(function (req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, GET, PATCH, DELETE, OPTIONS"
  );
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use("/api/", apiLimiter);

app.use("/api/user", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/message", messageRoutes);


const __dirname1 = path.resolve();

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname1, "frontend", "build")));

  app.get("*", (req, res) => {
    res.sendFile(path.resolve(__dirname1, "frontend", "build", "index.html"));
  });
} else {
  app.get("/", (req, res) => {
    res.send("API is running..");
  });
}


app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(
  PORT,
  console.log(`Server running on PORT ${PORT}...`)
);

const io = require("socket.io")(server, {
  pingTimeout: 60000,
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  },
});

const onlineUsers = new Set();

io.on("connection", (socket) => {
  socket.on("setup", (userData) => {
    socket.join(userData._id);
    socket.emit("connected");

    onlineUsers.add(userData._id);
    socket.broadcast.emit("user online", userData._id);
    socket.emit("online users", Array.from(onlineUsers));

    socket.on("disconnect", () => {
      onlineUsers.delete(userData._id);
      socket.broadcast.emit("user offline", userData._id);
      socket.leave(userData._id);
    });
  });

  socket.on("join chat", (room) => {
    socket.join(room);
  });
  socket.on("typing", ({ room, userName }) => socket.in(room).emit("typing", userName));
  socket.on("stop typing", (room) => socket.in(room).emit("stop typing"));

  socket.on("new message", (newMessageReceived) => {
    const chat = newMessageReceived.chat;

    if (!chat.users) return;

    chat.users.forEach((user) => {
      if (user._id === newMessageReceived.sender._id) return;

      socket.in(user._id).emit("message received", newMessageReceived);
    });
  });

  socket.on("react message", (updatedMessage) => {
    const chat = updatedMessage.chat;
    if (!chat.users) return;

    chat.users.forEach((user) => {
      socket.in(user._id).emit("reaction updated", updatedMessage);
    });
  });

  socket.on("messages read", ({ chatId, userId, chatUsers }) => {
    if (!chatUsers) return;
    chatUsers.forEach((user) => {
      if (user._id !== userId) {
        socket.in(user._id).emit("messages read", { chatId, userId });
      }
    });
  });

  socket.on("message edited", (updatedMessage) => {
    const chat = updatedMessage.chat;
    if (!chat.users) return;
    chat.users.forEach((user) => {
      socket.in(user._id).emit("message edited", updatedMessage);
    });
  });

  socket.on("message deleted", (updatedMessage) => {
    const chat = updatedMessage.chat;
    if (!chat.users) return;
    chat.users.forEach((user) => {
      socket.in(user._id).emit("message deleted", updatedMessage);
    });
  });

});
