import React, { useRef, useState } from "react";
import { Bell, LogOut, User, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ChatState } from "../Context/ChatProvider";
import { getSender } from "../config/ChatLogics";
import ProfileModal from "./miscellaneous/ProfileModal";
import Avatar from "./UserAvatar/Avatar";
import api from "../config/api";

const NavPanel = () => {
  const [showNotifs, setShowNotifs] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { user, setUser, setSelectedChat, notification, setNotification } = ChatState();
  const navigate = useNavigate();
  const notifRef = useRef(null);
  const userMenuRef = useRef(null);

  const logoutHandler = async () => {
    try { await api.post("/api/user/logout"); } catch (_) {}
    localStorage.removeItem("userInfo");
    setUser(null);
    navigate("/");
  };

  return (
    <div className="w-16 flex flex-col items-center py-4 bg-elevated border-r border-border flex-shrink-0 gap-3">
      <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center flex-shrink-0 mb-2">
        <MessageSquare size={18} className="text-white" />
      </div>

      <div className="flex-1" />

      <div className="relative" ref={notifRef}>
        <button
          onClick={() => { setShowNotifs(!showNotifs); setShowUserMenu(false); }}
          className="relative w-10 h-10 flex items-center justify-center rounded-xl text-muted hover:text-text hover:bg-border transition-colors"
        >
          <Bell size={20} />
          {notification.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
              {notification.length > 9 ? "9+" : notification.length}
            </span>
          )}
        </button>

        {showNotifs && (
          <div className="absolute left-12 bottom-0 w-64 bg-surface border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
            <div className="px-3 py-2 border-b border-border">
              <span className="text-xs font-semibold text-muted uppercase tracking-wide">Notifications</span>
            </div>
            {notification.length === 0 ? (
              <div className="px-3 py-4 text-sm text-muted text-center">No new messages</div>
            ) : (
              notification.map((notif) => (
                <button
                  key={notif._id}
                  className="w-full text-left px-3 py-2.5 text-sm text-text hover:bg-elevated transition-colors border-b border-border/50 last:border-0"
                  onClick={() => {
                    setSelectedChat(notif.chat);
                    setNotification(notification.filter((n) => n !== notif));
                    setShowNotifs(false);
                  }}
                >
                  {notif.chat.isGroupChat
                    ? `New message in ${notif.chat.chatName}`
                    : `New message from ${getSender(user, notif.chat.users)}`}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="relative" ref={userMenuRef}>
        <button
          onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifs(false); }}
          className="rounded-xl border-2 border-border hover:border-accent transition-colors flex-shrink-0"
        >
          <Avatar src={user?.pic} name={user?.name} size="md" className="rounded-xl" />
        </button>

        {showUserMenu && (
          <div className="absolute left-12 bottom-0 w-48 bg-surface border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
            <div className="px-3 py-2.5 border-b border-border">
              <div className="text-sm font-medium text-text truncate">{user?.name}</div>
              <div className="text-xs text-muted truncate">{user?.email}</div>
            </div>
            <div className="py-1">
              <button
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text hover:bg-elevated transition-colors"
                onClick={() => { setShowUserMenu(false); setProfileOpen(true); }}
              >
                <User size={15} className="text-muted" />
                My Profile
              </button>
              <button
                onClick={logoutHandler}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-red-900/20 transition-colors"
              >
                <LogOut size={15} />
                Logout
              </button>
            </div>
          </div>
        )}
      </div>

      <ProfileModal user={user} open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  );
};

export default NavPanel;
