// db.js
// Bahut simple JSON-file based "database". Production ke liye ise
// MongoDB / PostgreSQL / MySQL se replace karna behtar rahega, lekin
// local test aur demo ke liye yeh bina kisi native dependency ke
// turant chal jaata hai.

const fs = require("fs");
const path = require("path");

const STORAGE_ROOT = process.env.STORAGE_DIR || path.join(__dirname, "storage");
const DATA_DIR = path.join(STORAGE_ROOT, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");

function ensureFile(file, defaultValue) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(defaultValue, null, 2));
  }
}

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
ensureFile(USERS_FILE, []);
ensureFile(MESSAGES_FILE, []);

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ---------- Users ----------
function getAllUsers() {
  return readJSON(USERS_FILE);
}
function saveAllUsers(users) {
  writeJSON(USERS_FILE, users);
}
function findUserByUsername(username) {
  const users = getAllUsers();
  return users.find(
    (u) => u.username.toLowerCase() === String(username).toLowerCase()
  );
}
function findUserById(id) {
  const users = getAllUsers();
  return users.find((u) => u.id === id);
}
function createUser(user) {
  const users = getAllUsers();
  users.push(user);
  saveAllUsers(users);
  return user;
}
function updateUser(id, patch) {
  const users = getAllUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return null;
  users[idx] = { ...users[idx], ...patch };
  saveAllUsers(users);
  return users[idx];
}
function searchUsersByUsername(query) {
  const users = getAllUsers();
  const q = String(query).toLowerCase();
  return users.filter((u) => u.username.toLowerCase().includes(q));
}

// ---------- Messages ----------
function getAllMessages() {
  return readJSON(MESSAGES_FILE);
}
function saveMessage(msg) {
  const messages = getAllMessages();
  messages.push(msg);
  writeJSON(MESSAGES_FILE, messages);
  return msg;
}
function getConversation(userA, userB) {
  const messages = getAllMessages();
  return messages
    .filter(
      (m) =>
        (m.from === userA && m.to === userB) ||
        (m.from === userB && m.to === userA)
    )
    .sort((a, b) => a.createdAt - b.createdAt);
}
function getConversationsForUser(userId) {
  const messages = getAllMessages();
  const partnerIds = new Set();
  messages.forEach((m) => {
    if (m.from === userId) partnerIds.add(m.to);
    if (m.to === userId) partnerIds.add(m.from);
  });
  return Array.from(partnerIds);
}

module.exports = {
  findUserByUsername,
  findUserById,
  createUser,
  updateUser,
  searchUsersByUsername,
  getAllUsers,
  saveMessage,
  getConversation,
  getConversationsForUser,
};
