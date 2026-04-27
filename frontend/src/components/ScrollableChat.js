import React, { useEffect, useRef, useState } from "react";
import { Clock, Pencil, Reply, SmilePlus, Trash2 } from "lucide-react";
import {
  isLastMessage,
  isSameSender,
  isSameSenderMargin,
  isSameUser,
} from "../config/ChatLogics";
import { ChatState } from "../Context/ChatProvider";
import Avatar from "./UserAvatar/Avatar";

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "👏"];

const formatTime = (dateStr) => {
  const date = new Date(dateStr);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (date.toDateString() === now.toDateString()) return timeStr;
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday ${timeStr}`;
  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })} ${timeStr}`;
};

const formatDateSeparator = (dateStr) => {
  const date = new Date(dateStr);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === now.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
};

const isDifferentDay = (a, b) =>
  new Date(a.createdAt).toDateString() !== new Date(b.createdAt).toDateString();

const ScrollableChat = ({
  messages,
  onReact,
  onReply,
  onEdit,
  onDelete,
  lastSeenByOtherMsgId,
}) => {
  const { user } = ChatState();
  const bottomRef = useRef(null);
  const [hoveredMsg, setHoveredMsg] = useState(null);
  const [emojiPickerFor, setEmojiPickerFor] = useState(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleEmojiClick = (messageId, emoji) => {
    onReact(messageId, emoji);
    setEmojiPickerFor(null);
    setHoveredMsg(null);
  };

  return (
    <div className="messages px-4 py-2">
      {messages.map((m, i) => {
        const isSent = m.sender._id === user._id;
        const showAvatar =
          isSameSender(messages, m, i, user._id) ||
          isLastMessage(messages, i, user._id);
        const marginLeft = isSameSenderMargin(messages, m, i, user._id);
        const marginTop = isSameUser(messages, m, i, user._id) ? 2 : 10;

        return (
          <React.Fragment key={m._id}>
            {(i === 0 || isDifferentDay(messages[i - 1], m)) && (
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted px-2 flex-shrink-0">
                  {formatDateSeparator(m.createdAt)}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>
            )}

            <div
              className={`relative flex items-end transition-opacity ${m.status === "pending" ? "opacity-50" : ""}`}
              style={{ marginTop }}
              onMouseEnter={() => setHoveredMsg(m._id)}
              onMouseLeave={() => { setHoveredMsg(null); setEmojiPickerFor(null); }}
            >
              {showAvatar ? (
                <Avatar
                  src={m.sender.pic}
                  name={m.sender.name}
                  size="sm"
                  className="mr-2 mb-0.5 cursor-pointer"
                />
              ) : (
                <div style={{ marginLeft }} className="w-7 mr-2 flex-shrink-0" />
              )}

              <div
                className={`relative flex flex-col ${isSent ? "items-end ml-auto" : "items-start"}`}
                style={{ maxWidth: "72%" }}
              >
                {m.isDeleted ? (
                  <div className="px-4 py-2 rounded-2xl border border-border bg-transparent">
                    <span className="text-xs text-muted italic">
                      This message was deleted
                    </span>
                  </div>
                ) : (
                  <div
                    className={`rounded-2xl px-4 py-2 ${
                      isSent
                        ? "bg-bubble-sent text-white rounded-br-sm"
                        : "bg-bubble-recv text-text rounded-bl-sm"
                    }`}
                  >
                    {m.replyTo && (
                      <div
                        className={`mb-2 px-2 py-1.5 rounded-lg border-l-2 text-xs ${
                          isSent
                            ? "border-white/40 bg-white/10 text-white/70"
                            : "border-accent/60 bg-white/5 text-muted"
                        }`}
                      >
                        <div className="font-semibold mb-0.5">
                          {m.replyTo.sender?.name}
                        </div>
                        <div className="truncate">
                          {m.replyTo.fileType
                            ? m.replyTo.fileType === "image" ? "📷 Photo" : "📎 File"
                            : m.replyTo.content}
                        </div>
                      </div>
                    )}

                    {m.fileType === "image" && m.fileUrl && (
                      <img
                        src={m.fileUrl}
                        alt="attachment"
                        className="rounded-xl max-w-xs max-h-64 object-cover mb-1 cursor-pointer"
                        onClick={() => window.open(m.fileUrl, "_blank")}
                      />
                    )}

                    {m.fileType === "file" && m.fileUrl && (
                      <a
                        href={m.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={`flex items-center gap-2 text-sm underline mb-1 ${
                          isSent ? "text-white/80" : "text-accent"
                        }`}
                      >
                        📎 Download file
                      </a>
                    )}

                    {m.content && (
                      <div className="text-sm leading-relaxed break-words">
                        {m.content}
                      </div>
                    )}

                    <div
                      className={`text-[10px] mt-1 text-right flex items-center justify-end gap-1 ${
                        isSent ? "text-white/60" : "text-muted"
                      }`}
                    >
                      {m.editedAt && <span className="italic opacity-70">edited</span>}
                      {m.status === "pending"
                        ? <Clock size={10} className="animate-pulse" />
                        : m.createdAt ? formatTime(m.createdAt) : ""}
                    </div>
                  </div>
                )}

                {!m.isDeleted && !m.status && m.reactions?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {m.reactions.map((r) => {
                      const hasReacted = r.users.some(
                        (id) => id === user._id || id.toString() === user._id
                      );
                      return (
                        <button
                          key={r.emoji}
                          onClick={() => onReact(m._id, r.emoji)}
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
                            hasReacted
                              ? "bg-accent/20 border-accent/50 text-accent"
                              : "bg-elevated border-border text-muted hover:border-accent/40"
                          }`}
                        >
                          {r.emoji}
                          <span>{r.users.length}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {lastSeenByOtherMsgId === m._id && (
                  <span className="text-[10px] text-muted mt-0.5">Seen</span>
                )}

                {hoveredMsg === m._id && !m.isDeleted && !m.status && (
                  <div
                    className={`absolute top-0 flex items-center gap-0.5 z-10 ${
                      isSent ? "right-full pr-2" : "left-full pl-2"
                    }`}
                  >
                    <button
                      onClick={() => onReply(m)}
                      className="p-1.5 rounded-md bg-elevated border border-border text-muted hover:text-text hover:border-accent/40 transition-colors"
                      title="Reply"
                    >
                      <Reply size={13} />
                    </button>

                    <div className="relative">
                      <button
                        onClick={() =>
                          setEmojiPickerFor(emojiPickerFor === m._id ? null : m._id)
                        }
                        className="p-1.5 rounded-md bg-elevated border border-border text-muted hover:text-text hover:border-accent/40 transition-colors"
                        title="React"
                      >
                        <SmilePlus size={13} />
                      </button>

                      {emojiPickerFor === m._id && (
                        <div
                          className={`absolute top-full mt-1 flex gap-1 p-1.5 bg-surface border border-border rounded-xl shadow-xl z-20 ${
                            isSent ? "right-0" : "left-0"
                          }`}
                        >
                          {EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => handleEmojiClick(m._id, emoji)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-elevated text-base transition-colors"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {isSent && m.content && !m.fileUrl && (
                      <button
                        onClick={() => onEdit(m)}
                        className="p-1.5 rounded-md bg-elevated border border-border text-muted hover:text-text hover:border-accent/40 transition-colors"
                        title="Edit"
                      >
                        <Pencil size={13} />
                      </button>
                    )}

                    {isSent && (
                      <button
                        onClick={() => onDelete(m._id)}
                        className="p-1.5 rounded-md bg-elevated border border-border text-muted hover:text-red-400 hover:border-red-400/40 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </React.Fragment>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
};

export default ScrollableChat;
