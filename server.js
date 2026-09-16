// server.js
const path = require("path");
const fs = require("fs");
const express = require("express");
const session = require("express-session");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const http = require("http");
const { Server } = require("socket.io");

const db = require("./db");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const STORAGE_ROOT = process.env.STORAGE_DIR || path.join(__dirname, "storage");
const UPLOAD_DIR = path.join(STORAGE_ROOT, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------- middleware ----------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || "change-this-secret-before-deploying",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }, // 7 days
});
app.use(sessionMiddleware);

// share express session with socket.io
io.engine.use(sessionMiddleware);

app.use("/uploads", express.static(UPLOAD_DIR));
app.use(express.static(path.join(__dirname, "public")));

// ---------- multer (photo upload) ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});
function fileFilter(req, file, cb) {
  const allowed = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowed.includes(ext)) {
    return cb(new Error("Sirf image files allowed hain (jpg, png, webp, gif)"));
  }
  cb(null, true);
}
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// ---------- helpers ----------
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Login zaroori hai" });
  }
  next();
}
function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    bio: u.bio || "",
    photo: u.photo ? `/uploads/${u.photo}` : null,
    createdAt: u.createdAt,
  };
}

// ---------- auth routes ----------
app.post("/api/register", upload.single("photo"), (req, res) => {
  try {
    const { username, password, bio } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username aur password zaroori hain" });
    }
    const cleanUsername = String(username).trim().toLowerCase();
    if (!/^[a-z0-9_.]{3,20}$/.test(cleanUsername)) {
      return res.status(400).json({
        error:
          "Username 3-20 characters ka ho, sirf letters/numbers/underscore/dot allowed",
      });
    }
    if (db.findUserByUsername(cleanUsername)) {
      return res.status(409).json({ error: "Yeh username pehle se liya gaya hai" });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: "Password kam se kam 6 characters ka ho" });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const user = {
      id: uuidv4(),
      username: cleanUsername,
      passwordHash,
      bio: bio || "",
      photo: req.file ? req.file.filename : null,
      createdAt: Date.now(),
    };
    db.createUser(user);

    req.session.userId = user.id;
    res.json({ user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration fail ho gaya, dobara try karein" });
  }
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const user = db.findUserByUsername(String(username || "").trim().toLowerCase());
  if (!user || !bcrypt.compareSync(password || "", user.passwordHash)) {
    return res.status(401).json({ error: "Username ya password galat hai" });
  }
  req.session.userId = user.id;
  res.json({ user: publicUser(user) });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/me", requireAuth, (req, res) => {
  const user = db.findUserById(req.session.userId);
  res.json({ user: publicUser(user) });
});

// update profile photo / bio
app.post(
  "/api/me/photo",
  requireAuth,
  upload.single("photo"),
  (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Photo file nahi mili" });
    const updated = db.updateUser(req.session.userId, { photo: req.file.filename });
    res.json({ user: publicUser(updated) });
  }
);

app.post("/api/me/bio", requireAuth, (req, res) => {
  const updated = db.updateUser(req.session.userId, { bio: req.body.bio || "" });
  res.json({ user: publicUser(updated) });
});

// ---------- search ----------
app.get("/api/search", requireAuth, (req, res) => {
  const q = String(req.query.username || "").trim();
  if (!q) return res.json({ users: [] });
  const results = db
    .searchUsersByUsername(q)
    .filter((u) => u.id !== req.session.userId)
    .slice(0, 20)
    .map(publicUser);
  res.json({ users: results });
});

app.get("/api/user/:id", requireAuth, (req, res) => {
  const user = db.findUserById(req.params.id);
  if (!user) return res.status(404).json({ error: "User nahi mila" });
  res.json({ user: publicUser(user) });
});

// ---------- chat ----------
app.get("/api/conversations", requireAuth, (req, res) => {
  const partnerIds = db.getConversationsForUser(req.session.userId);
  const conversations = partnerIds
    .map((id) => db.findUserById(id))
    .filter(Boolean)
    .map((u) => {
      const convo = db.getConversation(req.session.userId, u.id);
      const last = convo[convo.length - 1];
      return {
        user: publicUser(u),
        lastMessage: last ? last.text : "",
        lastAt: last ? last.createdAt : 0,
      };
    })
    .sort((a, b) => b.lastAt - a.lastAt);
  res.json({ conversations });
});

app.get("/api/messages/:otherId", requireAuth, (req, res) => {
  const messages = db.getConversation(req.session.userId, req.params.otherId);
  res.json({ messages });
});

// ---------- socket.io real-time chat ----------
const onlineUsers = new Map(); // userId -> Set of socket.ids

io.on("connection", (socket) => {
  const session = socket.request.session;
  const userId = session && session.userId;

  if (!userId) {
    socket.disconnect();
    return;
  }

  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId).add(socket.id);

  socket.on("send-message", (payload, ack) => {
    const { to, text } = payload || {};
    if (!to || !text || !String(text).trim()) return;
    if (!db.findUserById(to)) return;

    const message = {
      id: uuidv4(),
      from: userId,
      to,
      text: String(text).trim().slice(0, 2000),
      createdAt: Date.now(),
    };
    db.saveMessage(message);

    // deliver to recipient if online
    const recipientSockets = onlineUsers.get(to);
    if (recipientSockets) {
      recipientSockets.forEach((sid) => io.to(sid).emit("new-message", message));
    }
    // echo back to sender's other tabs
    const senderSockets = onlineUsers.get(userId);
    if (senderSockets) {
      senderSockets.forEach((sid) => {
        if (sid !== socket.id) io.to(sid).emit("new-message", message);
      });
    }
    if (typeof ack === "function") ack(message);
  });

  socket.on("disconnect", () => {
    const set = onlineUsers.get(userId);
    if (set) {
      set.delete(socket.id);
      if (set.size === 0) onlineUsers.delete(userId);
    }
  });
});

// fallback -> index.html for unknown routes (simple SPA-ish behaviour)
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) return next();
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

server.listen(PORT, () => {
  console.log(`Saathi app chal raha hai: http://localhost:${PORT}`);
});
