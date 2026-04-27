# Chit-Chat

A full-stack real-time chat application built with the MERN stack and Socket.io.

## Features

- **Real-time messaging** — WebSocket-powered instant delivery with typing indicators
- **1-on-1 and group chats** — create, rename, and manage group members
- **Message reactions** — emoji reactions with live sync across all participants
- **Reply & quote** — thread replies with quoted message preview
- **Edit & soft-delete** — edit history preserved; deleted messages show a placeholder
- **Image sharing** — upload images via Cloudinary, rendered inline in the chat
- **Message search** — full-text search within any conversation
- **Read receipts** — "Seen" label on the last message read by the other user
- **Unread badges** — per-chat unread count, cleared on open
- **Online indicators** — green dot for connected users, updated in real time
- **Rate limiting** — per-IP limits on auth (10/15 min), messages (30/min), and global API (120/min)
- **Auth** — JWT stored in httpOnly cookie (30-day expiry); XSS-safe

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, Express 4.18, Mongoose 6.3, Socket.io 4.5 |
| Frontend | React 18, Tailwind CSS v3, Radix UI, Lucide React, Framer Motion |
| Auth | JWT + bcryptjs, httpOnly SameSite=Lax cookie |
| Database | MongoDB Atlas |
| File storage | Cloudinary (image uploads) |

## Project Structure

```
ChatApp/
├── backend/
│   ├── config/          # DB connection, JWT helper
│   ├── controllers/     # Route handlers
│   ├── middlewares/     # Auth, error handling, rate limiters
│   ├── models/          # Mongoose schemas (User, Chat, Message)
│   ├── routes/
│   └── server.js        # Express app + Socket.io
├── frontend/
│   └── src/
│       ├── components/  # NavPanel, MyChats, SingleChat, ScrollableChat, modals
│       ├── config/      # Axios instance, chat logic helpers
│       ├── Context/     # ChatProvider (global state)
│       └── pages/       # HomePage, ChatPage
├── .env
└── Procfile
```

## Getting Started

### Prerequisites

- Node.js 16+
- A MongoDB Atlas cluster (or local MongoDB)
- A Cloudinary account (free tier is fine)

### 1. Clone and install

```bash
git clone <repo-url>
cd ChatApp

# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Environment variables

Create `.env` in the project root (`ChatApp/`):

```env
PORT=5000
MONGO_URI=<your-mongodb-connection-string>
JWT_SECRET=<a-long-random-secret>
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

Create `frontend/.env`:

```env
REACT_APP_SOCKET_ENDPOINT=http://localhost:5000
REACT_APP_CLOUDINARY_CLOUD_NAME=<your-cloudinary-cloud-name>
REACT_APP_CLOUDINARY_UPLOAD_PRESET=<your-upload-preset>
```

> The Cloudinary upload preset must be set to **unsigned** in your Cloudinary dashboard.

### 3. Run in development

```bash
# Terminal 1 — backend (port 5000)
npm start

# Terminal 2 — frontend (port 3000)
cd frontend && npm start
```

The frontend proxies `/api/*` requests to `http://127.0.0.1:5000`.

### 4. Production build

```bash
cd frontend && npm run build && cd ..
NODE_ENV=production node backend/server.js
```

In production mode Express serves `frontend/build/` statically and handles all routes.

## API Overview

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/user | No | Register |
| POST | /api/user/login | No | Login |
| POST | /api/user/logout | Yes | Clear auth cookie |
| GET | /api/user?search= | Yes | Search users |
| GET | /api/chat | Yes | List user's chats |
| POST | /api/chat | Yes | Access or create 1-on-1 chat |
| POST | /api/chat/group | Yes | Create group chat |
| PUT | /api/chat/rename | Yes | Rename group |
| PUT | /api/chat/groupadd | Yes | Add member |
| PUT | /api/chat/groupremove | Yes | Remove member |
| GET | /api/message/:chatId | Yes | Get messages (paginated) |
| POST | /api/message | Yes | Send message |
| PUT | /api/message/markread | Yes | Mark chat as read |
| GET | /api/message/search | Yes | Full-text search |
| PUT | /api/message/:id/react | Yes | Toggle emoji reaction |
| PATCH | /api/message/:id | Yes | Edit message |
| DELETE | /api/message/:id | Yes | Soft-delete message |

Pagination: `GET /api/message/:chatId?limit=50&before=<messageId>`

## Author

**Krishna Vishnoi**
