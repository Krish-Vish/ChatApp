import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ImagePlus, Loader2, Pencil, Search, Send, X } from "lucide-react";
import toast from "react-hot-toast";
import { ChatState } from "../Context/ChatProvider";
import { getSender, getSenderFull } from "../config/ChatLogics";
import ProfileModal from "./miscellaneous/ProfileModal";
import UpdateGroupChatModal from "./miscellaneous/UpdateGroupChatModal";
import Avatar from "./UserAvatar/Avatar";
import api from "../config/api";
import "./styles.css";
import ScrollableChat from "./ScrollableChat";
import io from "socket.io-client";

const ENDPOINT = process.env.REACT_APP_SOCKET_ENDPOINT || "http://localhost:5000";
let socket, selectedChatCompare;

const formatSearchTime = (dateStr) => {
  const date = new Date(dateStr);
  const now = new Date();
  if (date.toDateString() === now.toDateString())
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
};

const SingleChat = ({ fetchAgain, setFetchAgain }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);
  const [typing, setTyping] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState("");

  const [replyTo, setReplyTo] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [fileUploading, setFileUploading] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);

  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeout = useRef(null);

  const {
    user,
    selectedChat,
    setSelectedChat,
    notification,
    setNotification,
    setOnlineUsers,
  } = ChatState();

  const fileInputRef = useRef(null);

  useEffect(() => {
    socket = io(ENDPOINT, { withCredentials: true });
    socket.emit("setup", user);
    socket.on("connected", () => setSocketConnected(true));
    socket.on("typing", (name) => { setIsTyping(true); setTypingUser(name); });
    socket.on("stop typing", () => setIsTyping(false));
    socket.on("online users", (users) => setOnlineUsers(new Set(users)));
    socket.on("user online", (userId) =>
      setOnlineUsers((prev) => new Set([...prev, userId]))
    );
    socket.on("user offline", (userId) =>
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      })
    );
    return () => { socket.disconnect(); };
  }, [user, setOnlineUsers]);

  const markRead = useCallback(async (chat) => {
    if (!chat) return;
    try {
      await api.put("/api/message/markread", { chatId: chat._id });
      socket.emit("messages read", {
        chatId: chat._id,
        userId: user._id,
        chatUsers: chat.users,
      });
    } catch (_) {}
  }, [user]);

  const fetchMessages = useCallback(async () => {
    if (!selectedChat) return;
    try {
      setLoading(true);
      const { data } = await api.get(`/api/message/${selectedChat._id}?limit=50`);
      setMessages(data);
      setHasMore(data.length === 50);
      setLoading(false);
      socket.emit("join chat", selectedChat._id);
      markRead(selectedChat);
    } catch {
      toast.error("Failed to load messages");
      setLoading(false);
    }
  }, [selectedChat, markRead]);

  const loadMoreMessages = async () => {
    if (!messages.length) return;
    try {
      setLoadingMore(true);
      const { data } = await api.get(
        `/api/message/${selectedChat._id}?limit=50&before=${messages[0]._id}`
      );
      setMessages([...data, ...messages]);
      setHasMore(data.length === 50);
      setLoadingMore(false);
    } catch {
      toast.error("Failed to load older messages");
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    setIsSearching(false);
    setSearchQuery("");
    setSearchResults([]);
    setEditingMessage(null);
    setReplyTo(null);
    setPendingFile(null);
    fetchMessages();
    selectedChatCompare = selectedChat;
  }, [selectedChat, fetchMessages]);

  useEffect(() => {
    socket.on("message received", (newMsg) => {
      if (!selectedChatCompare || selectedChatCompare._id !== newMsg.chat._id) {
        if (!notification.includes(newMsg)) {
          setNotification([newMsg, ...notification]);
          setFetchAgain(!fetchAgain);
        }
      } else {
        setMessages((prev) => [...prev, newMsg]);
        markRead(selectedChatCompare);
      }
    });
    return () => { socket.off("message received"); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, notification, fetchAgain, markRead]);

  useEffect(() => {
    socket.on("reaction updated", (updated) => {
      setMessages((prev) => prev.map((m) => m._id === updated._id ? updated : m));
    });
    return () => { socket.off("reaction updated"); };
  }, []);

  useEffect(() => {
    socket.on("messages read", ({ chatId, userId }) => {
      if (selectedChatCompare?._id === chatId) {
        setMessages((prev) =>
          prev.map((m) => {
            const alreadyIn = m.readBy.some(
              (id) => id === userId || id.toString() === userId
            );
            return alreadyIn ? m : { ...m, readBy: [...m.readBy, userId] };
          })
        );
      }
    });
    return () => { socket.off("messages read"); };
  }, []);

  useEffect(() => {
    socket.on("message edited", (updated) => {
      setMessages((prev) => prev.map((m) => m._id === updated._id ? updated : m));
    });
    socket.on("message deleted", (updated) => {
      setMessages((prev) => prev.map((m) => m._id === updated._id ? updated : m));
    });
    return () => {
      socket.off("message edited");
      socket.off("message deleted");
    };
  }, []);

  const doSend = async () => {
    if (editingMessage) {
      if (!newMessage.trim()) return;
      const content = newMessage.trim();
      const msgId = editingMessage._id;
      setNewMessage("");
      setEditingMessage(null);
      try {
        const { data } = await api.patch(`/api/message/${msgId}`, { content });
        setMessages((prev) => prev.map((m) => m._id === msgId ? data : m));
        socket.emit("message edited", data);
      } catch {
        toast.error("Failed to edit message");
      }
      return;
    }

    if (!newMessage && !pendingFile) return;
    socket.emit("stop typing", selectedChat._id);

    const content = newMessage;
    const file = pendingFile;
    const reply = replyTo;
    setNewMessage("");
    setReplyTo(null);
    setPendingFile(null);

    const tempId = `temp_${Date.now()}`;
    const optimisticMsg = {
      _id: tempId,
      content: content || "",
      sender: { _id: user._id, name: user.name, pic: user.pic },
      chat: selectedChat,
      readBy: [user._id],
      reactions: [],
      isDeleted: false,
      createdAt: new Date().toISOString(),
      replyTo: reply || null,
      fileUrl: file?.url || null,
      fileType: file?.type || null,
      status: "pending",
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const body = { chatId: selectedChat._id, content };
      if (reply) body.replyTo = reply._id;
      if (file) { body.fileUrl = file.url; body.fileType = file.type; }

      const { data } = await api.post("/api/message", body);
      setMessages((prev) => prev.map((m) => m._id === tempId ? data : m));
      socket.emit("new message", data);
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m._id !== tempId));
      setNewMessage(content);
      if (file) setPendingFile(file);
      if (reply) setReplyTo(reply);
      const detail = err.response?.data?.message;
      toast.error(detail ? `Send failed: ${detail}` : "Failed to send message");
    }
  };

  const sendMessage = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); }
  };

  const typingHandler = (e) => {
    setNewMessage(e.target.value);
    if (!socketConnected || editingMessage) return;
    if (!typing) {
      setTyping(true);
      socket.emit("typing", { room: selectedChat._id, userName: user.name });
    }
    const lastTypingTime = new Date().getTime();
    setTimeout(() => {
      const timeNow = new Date().getTime();
      if (timeNow - lastTypingTime >= 3000 && typing) {
        socket.emit("stop typing", selectedChat._id);
        setTyping(false);
      }
    }, 3000);
  };

  const handleReact = async (messageId, emoji) => {
    try {
      const { data } = await api.put(`/api/message/${messageId}/react`, { emoji });
      setMessages((prev) => prev.map((m) => m._id === messageId ? data : m));
      socket.emit("react message", data);
    } catch {
      toast.error("Failed to add reaction");
    }
  };

  const handleEdit = (message) => {
    setEditingMessage(message);
    setNewMessage(message.content);
    setReplyTo(null);
  };

  const handleDelete = async (messageId) => {
    try {
      const { data } = await api.delete(`/api/message/${messageId}`);
      setMessages((prev) => prev.map((m) => m._id === messageId ? data : m));
      socket.emit("message deleted", data);
    } catch {
      toast.error("Failed to delete message");
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Only image uploads are supported");
      return;
    }
    setFileUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET);
    formData.append("cloud_name", process.env.REACT_APP_CLOUDINARY_CLOUD_NAME);
    try {
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.REACT_APP_CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: "POST", body: formData }
      );
      const data = await res.json();
      setPendingFile({ url: data.secure_url, type: "image" });
      setFileUploading(false);
    } catch {
      toast.error("Image upload failed");
      setFileUploading(false);
    }
  };

  const handleSearchChange = (value) => {
    setSearchQuery(value);
    clearTimeout(searchTimeout.current);
    if (!value.trim()) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      try {
        setSearchLoading(true);
        const { data } = await api.get(
          `/api/message/search?chatId=${selectedChat._id}&q=${encodeURIComponent(value.trim())}`
        );
        setSearchResults(data);
        setSearchLoading(false);
      } catch {
        toast.error("Search failed");
        setSearchLoading(false);
      }
    }, 350);
  };

  const closeSearch = () => {
    setIsSearching(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  const lastSeenByOtherMsgId = useMemo(() => {
    if (!selectedChat || selectedChat.isGroupChat) return null;
    const other = selectedChat.users.find((u) => u._id !== user._id);
    if (!other) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (
        m.sender._id === user._id &&
        m.readBy.some((id) => id === other._id || id.toString() === other._id)
      ) {
        return m._id;
      }
    }
    return null;
  }, [messages, selectedChat, user]);

  if (!selectedChat) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-base">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-elevated flex items-center justify-center mx-auto">
            <Send size={24} className="text-muted" />
          </div>
          <p className="text-muted text-lg font-medium">Select a conversation</p>
          <p className="text-muted/60 text-sm">Choose a chat from the sidebar to start messaging</p>
        </div>
      </div>
    );
  }

  const chatName = selectedChat.isGroupChat
    ? selectedChat.chatName
    : getSender(user, selectedChat.users);

  return (
    <div className="flex-1 flex flex-col bg-base overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-surface border-b border-border flex-shrink-0">
        <button
          className="md:hidden p-1.5 rounded-md text-muted hover:text-text hover:bg-elevated transition-colors"
          onClick={() => setSelectedChat("")}
        >
          <ArrowLeft size={18} />
        </button>

        {isSearching ? (
          <div className="flex-1 flex items-center gap-2 bg-elevated rounded-lg px-3 py-1.5 border border-border focus-within:border-accent transition-colors">
            <Search size={13} className="text-muted flex-shrink-0" />
            <input
              autoFocus
              className="flex-1 bg-transparent text-text placeholder-muted text-sm focus:outline-none"
              placeholder={`Search in ${chatName}...`}
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
            <button onClick={closeSearch} className="text-muted hover:text-text">
              <X size={13} />
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-text text-sm leading-tight truncate">{chatName}</h2>
              {!selectedChat.isGroupChat && (
                <p className="text-xs text-muted truncate">
                  {getSenderFull(user, selectedChat.users)?.email}
                </p>
              )}
            </div>
            <button
              onClick={() => setIsSearching(true)}
              className="p-1.5 rounded-md text-muted hover:text-text hover:bg-elevated transition-colors"
              title="Search messages"
            >
              <Search size={16} />
            </button>
          </>
        )}

        <div className="flex items-center gap-1 flex-shrink-0">
          {!selectedChat.isGroupChat ? (
            <ProfileModal user={getSenderFull(user, selectedChat.users)} />
          ) : (
            <UpdateGroupChatModal
              fetchAgain={fetchAgain}
              setFetchAgain={setFetchAgain}
              fetchMessages={fetchMessages}
            />
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-base">
        {isSearching ? (
          <div className="p-4">
            {searchLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 bg-elevated rounded-lg animate-pulse" />
                ))}
              </div>
            ) : searchResults.length > 0 ? (
              <>
                <p className="text-xs text-muted mb-3">
                  {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
                </p>
                <div className="space-y-1">
                  {searchResults.map((m) => (
                    <div
                      key={m._id}
                      onClick={closeSearch}
                      className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-elevated cursor-pointer transition-colors"
                    >
                      <Avatar
                        src={m.sender.pic}
                        name={m.sender.name}
                        size="sm"
                        className="flex-shrink-0 mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-text">
                            {m.sender.name}
                          </span>
                          <span className="text-[10px] text-muted flex-shrink-0">
                            {formatSearchTime(m.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-muted mt-0.5 truncate">{m.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : searchQuery ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Search size={32} className="text-muted/30 mb-3" />
                <p className="text-sm text-muted">No messages found for "{searchQuery}"</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Search size={32} className="text-muted/30 mb-3" />
                <p className="text-sm text-muted">Type to search messages</p>
              </div>
            )}
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {hasMore && (
              <div className="flex justify-center pt-3">
                <button
                  onClick={loadMoreMessages}
                  disabled={loadingMore}
                  className="px-3 py-1 rounded-full bg-elevated hover:bg-border text-muted text-xs font-medium transition-colors disabled:opacity-50"
                >
                  {loadingMore ? "Loading..." : "Load older messages"}
                </button>
              </div>
            )}
            <ScrollableChat
              messages={messages}
              onReact={handleReact}
              onReply={setReplyTo}
              onEdit={handleEdit}
              onDelete={handleDelete}
              lastSeenByOtherMsgId={lastSeenByOtherMsgId}
            />
          </>
        )}
      </div>

      {!isSearching && (
        <div className="flex-shrink-0 px-4 py-3 bg-surface border-t border-border">
          {isTyping && (
            <p className="text-xs text-muted mb-2 italic">{typingUser} is typing...</p>
          )}

          {editingMessage && (
            <div className="flex items-start gap-2 mb-2 px-3 py-2 bg-elevated rounded-lg border-l-2 border-yellow-500/60">
              <Pencil size={13} className="text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-yellow-400 mb-0.5">
                  Editing message
                </div>
                <div className="text-xs text-muted truncate">{editingMessage.content}</div>
              </div>
              <button
                onClick={() => { setEditingMessage(null); setNewMessage(""); }}
                className="text-muted hover:text-text flex-shrink-0 mt-0.5"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {replyTo && !editingMessage && (
            <div className="flex items-start gap-2 mb-2 px-3 py-2 bg-elevated rounded-lg border-l-2 border-accent">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-accent mb-0.5">
                  Replying to {replyTo.sender?.name}
                </div>
                <div className="text-xs text-muted truncate">
                  {replyTo.fileType
                    ? replyTo.fileType === "image" ? "📷 Photo" : "📎 File"
                    : replyTo.content}
                </div>
              </div>
              <button
                onClick={() => setReplyTo(null)}
                className="text-muted hover:text-text flex-shrink-0 mt-0.5"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {pendingFile && (
            <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-elevated rounded-lg">
              {pendingFile.type === "image" && (
                <img
                  src={pendingFile.url}
                  alt="preview"
                  className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                />
              )}
              <span className="text-xs text-muted flex-1 truncate">
                Photo ready to send
              </span>
              <button
                onClick={() => setPendingFile(null)}
                className="text-muted hover:text-text flex-shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 bg-elevated rounded-xl px-3 py-2 border border-border focus-within:border-accent transition-colors">
            {!editingMessage && (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={fileUploading}
                  className="text-muted hover:text-accent disabled:opacity-40 transition-colors flex-shrink-0"
                  title="Send image"
                >
                  {fileUploading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <ImagePlus size={18} />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </>
            )}

            <input
              className="flex-1 bg-transparent text-text placeholder-muted text-sm focus:outline-none"
              placeholder={
                editingMessage ? "Edit message..." : `Message ${chatName}...`
              }
              onChange={typingHandler}
              onKeyDown={sendMessage}
              value={newMessage}
              maxLength={500}
            />

            <button
              onClick={doSend}
              disabled={!newMessage && !pendingFile}
              className="p-1.5 rounded-lg text-muted hover:text-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SingleChat;
