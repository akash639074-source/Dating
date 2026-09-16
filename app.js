const PLACEHOLDER_AVATAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23c9a6b3'%3E%3Ccircle cx='12' cy='8' r='4'/%3E%3Cpath d='M4 20c0-4 3.6-7 8-7s8 3 8 7'/%3E%3C/svg%3E";

let me = null;
let activeChatUser = null;
let socket = null;

function avatarSrc(u) {
  return (u && u.photo) || PLACEHOLDER_AVATAR;
}
function timeLabel(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString("hi-IN", { hour: "2-digit", minute: "2-digit" });
}

async function init() {
  const res = await fetch("/api/me");
  if (!res.ok) {
    window.location.href = "/index.html";
    return;
  }
  const data = await res.json();
  me = data.user;
  document.getElementById("myPhoto").src = avatarSrc(me);
  document.getElementById("myName").textContent = "@" + me.username;

  connectSocket();
  loadConversations();

  document.getElementById("logoutBtn").onclick = async () => {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/index.html";
  };

  document.getElementById("changePhotoBtn").onclick = () => {
    document.getElementById("photoInput").click();
  };
  document.getElementById("photoInput").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("photo", file);
    const r = await fetch("/api/me/photo", { method: "POST", body: fd });
    const d = await r.json();
    if (r.ok) {
      me = d.user;
      document.getElementById("myPhoto").src = avatarSrc(me);
    } else {
      alert(d.error || "Photo update fail hui");
    }
  });

  let searchTimer;
  document.getElementById("searchInput").addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    const q = e.target.value.trim();
    searchTimer = setTimeout(() => runSearch(q), 250);
  });

  document.getElementById("backBtn").onclick = () => {
    document.getElementById("sidebar").classList.remove("hide-mobile");
    document.getElementById("chatPanel").classList.add("hide-mobile");
  };

  document.getElementById("sendBtn").onclick = sendMessage;
  document.getElementById("msgInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });
}

function connectSocket() {
  socket = io();
  socket.on("new-message", (msg) => {
    if (
      activeChatUser &&
      (msg.from === activeChatUser.id || msg.to === activeChatUser.id)
    ) {
      appendBubble(msg);
    }
    loadConversations();
  });
}

async function runSearch(query) {
  const list = document.getElementById("resultsList");
  if (!query) {
    list.innerHTML = "";
    return;
  }
  const res = await fetch("/api/search?username=" + encodeURIComponent(query));
  const data = await res.json();
  if (!data.users.length) {
    list.innerHTML = '<div class="empty-hint">Koi username nahi mila</div>';
    return;
  }
  list.innerHTML = "";
  data.users.forEach((u) => {
    const el = document.createElement("div");
    el.className = "list-item";
    el.innerHTML = `
      <img src="${avatarSrc(u)}">
      <div class="meta"><h4>@${u.username}</h4><p>${u.bio || "ID: " + u.id.slice(0, 8)}</p></div>
    `;
    el.onclick = () => openChat(u);
    list.appendChild(el);
  });
}

async function loadConversations() {
  const res = await fetch("/api/conversations");
  const data = await res.json();
  const list = document.getElementById("convoList");
  if (!data.conversations.length) {
    list.innerHTML = '<div class="empty-hint">Abhi koi baatcheet nahi hai</div>';
    return;
  }
  list.innerHTML = "";
  data.conversations.forEach((c) => {
    const el = document.createElement("div");
    el.className = "list-item";
    if (activeChatUser && activeChatUser.id === c.user.id) el.classList.add("active");
    el.innerHTML = `
      <img src="${avatarSrc(c.user)}">
      <div class="meta">
        <h4>@${c.user.username}</h4>
        <p>${c.lastMessage}</p>
      </div>
      <small>${c.lastAt ? timeLabel(c.lastAt) : ""}</small>
    `;
    el.onclick = () => openChat(c.user);
    list.appendChild(el);
  });
}

async function openChat(user) {
  activeChatUser = user;
  document.getElementById("chatEmpty").style.display = "none";
  document.getElementById("chatArea").style.display = "flex";
  document.getElementById("chatPhoto").src = avatarSrc(user);
  document.getElementById("chatName").textContent = "@" + user.username;

  // mobile view swap
  document.getElementById("sidebar").classList.add("hide-mobile");
  document.getElementById("chatPanel").classList.remove("hide-mobile");

  const res = await fetch("/api/messages/" + user.id);
  const data = await res.json();
  const body = document.getElementById("chatBody");
  body.innerHTML = "";
  data.messages.forEach(appendBubble);
  body.scrollTop = body.scrollHeight;
}

function appendBubble(msg) {
  if (
    !activeChatUser ||
    !(
      (msg.from === me.id && msg.to === activeChatUser.id) ||
      (msg.to === me.id && msg.from === activeChatUser.id)
    )
  ) {
    return;
  }
  const body = document.getElementById("chatBody");
  const row = document.createElement("div");
  row.className = "bubble-row" + (msg.from === me.id ? " me" : "");
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = msg.text;
  row.appendChild(bubble);
  body.appendChild(row);
  body.scrollTop = body.scrollHeight;
}

function sendMessage() {
  const input = document.getElementById("msgInput");
  const text = input.value.trim();
  if (!text || !activeChatUser) return;
  socket.emit("send-message", { to: activeChatUser.id, text }, (msg) => {
    if (msg) appendBubble(msg);
  });
  input.value = "";
}

init();
