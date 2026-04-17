const KEYS = {
  users: "wa_users",
  currentUserId: "wa_current_user_id",
  messages: "wa_messages"
};

const state = {
  users: [],
  messages: [],
  currentUserId: null,
  activeChatUserId: null,
  selectedMessageIds: new Set()
};
const refs = {};

function q(id) { 
  return document.getElementById(id);
}

function boot() {
  cacheRefs();
  wireEvents();
  loadState();
  render();
}

function cacheRefs() {
  [
    "authScreen", "authError", "signupUsername", "signupDisplayName", "signupBtn",
    "app", "sidebar", "mobileOpenSidebar", "mobileCloseSidebar",
    "myAvatar", "myDisplayName", "myUsername", "openMyProfile",
    "searchUsers", "contacts", "newUserBtn", "switchUserBtn",
    "chatPartnerName", "chatPartnerHandle", "activeAvatar", "viewOtherProfile",
    "messages", "messageInput", "sendBtn",
    "selectionBar", "selectedCount", "deleteMe", "deleteEveryone", "cancelSelection",
    "myProfileModal", "profileAvatarMe", "profileNameMe", "profileUserMe", "editDisplayName", "saveProfile", "signOut", "closeMyProfile",
    "otherProfileModal", "profileAvatarOther", "profileNameOther", "profileUserOther", "closeOtherProfile",
    "newUserModal", "newUsername", "newDisplayName", "createNewUser", "closeNewUser", "newUserError"
  ].forEach((id) => {
    refs[id] = q(id);
  });
}

function wireEvents() {
  refs.signupBtn.addEventListener("click", handleSignupFromAuth);
  refs.signupUsername.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSignupFromAuth();
  });

  refs.sendBtn.addEventListener("click", handleSendMessage);
  refs.messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  refs.searchUsers.addEventListener("input", renderContacts);

  refs.openMyProfile.addEventListener("click", openMyProfile)
  refs.closeMyProfile.addEventListener("click", () => refs.myProfileModal.classList.add("hidden"));
  refs.saveProfile.addEventListener("click", saveProfile);
  refs.signOut.addEventListener("click", signOut);

  refs.viewOtherProfile.addEventListener("click", openOtherProfile);
  refs.closeOtherProfile.addEventListener("click", () => refs.otherProfileModal.classList.add("hidden"));

  refs.deleteMe.addEventListener("click", () => deleteSelected(false));
  refs.deleteEveryone.addEventListener("click", () => deleteSelected(true));
  refs.cancelSelection.addEventListener("click", clearSelection);

  refs.newUserBtn.addEventListener("click", () => {
    refs.newUserError.textContent = "";
    refs.newUsername.value = "";
    refs.newDisplayName.value = "";
    refs.newUserModal.classList.remove("hidden");
  });
  refs.closeNewUser.addEventListener("click", () => refs.newUserModal.classList.add("hidden"));
  refs.createNewUser.addEventListener("click", handleCreateAdditionalUser);
  refs.switchUserBtn.addEventListener("click", switchToNextUser);

  refs.mobileOpenSidebar.addEventListener("click", () => refs.sidebar.classList.add("open"));
  refs.mobileCloseSidebar.addEventListener("click", () => refs.sidebar.classList.remove("open"));
}

function loadState() {
  state.users = readJson(KEYS.users, []);
  state.messages = readJson(KEYS.messages, []);
  state.currentUserId = localStorage.getItem(KEYS.currentUserId);
}


function persistState() {
  localStorage.setItem(KEYS.users, JSON.stringify(state.users));
  localStorage.setItem(KEYS.messages, JSON.stringify(state.messages));
  if (state.currentUserId) {
    localStorage.setItem(KEYS.currentUserId, state.currentUserId);
  }
}

function render() {
  const currentUser = getCurrentUser();
  const hasSession = Boolean(currentUser);

  refs.authScreen.classList.toggle("hidden", hasSession);
  refs.app.classList.toggle("hidden", !hasSession);

  if (!hasSession) return;

  renderCurrentUserHeader();
  renderContacts();

  if (!state.activeChatUserId) {
    const firstContact = state.users.find((u) => u.id !== state.currentUserId);
    state.activeChatUserId = firstContact ? firstContact.id : null;
  }

  renderActiveChatHeader();
  renderMessages();
  renderSelectionBar();
}

function handleSignupFromAuth() {
  const username = refs.signupUsername.value.trim();
  const displayName = refs.signupDisplayName.value.trim() || username;
  refs.authError.textContent = "";

  const validationError = validateNewUser(username);
  if (validationError) {
    refs.authError.textContent = validationError;
    return;
  }

  const user = createUser(username, displayName);
  state.users.push(user);
  state.currentUserId = user.id;
  state.activeChatUserId = null;
  persistState();
  render();
}

function handleCreateAdditionalUser() {
  const username = refs.newUsername.value.trim();
  const displayName = refs.newDisplayName.value.trim() || username;

  const validationError = validateNewUser(username);
  if (validationError) {
    refs.newUserError.textContent = validationError;
    return;
  }

  const user = createUser(username, displayName);
  state.users.push(user);
  refs.newUserError.textContent = "User created successfully.";
  persistState();
  renderContacts();
}

function validateNewUser(username) {
  if (!username) return "Please enter a username.";
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return "Username must be 3-20 chars: letters, numbers, underscore.";
  }

  const exists = state.users.some((u) => u.username.toLowerCase() === username.toLowerCase());
  if (exists) return "Username already exists. Choose another.";
  return "";
}

function createUser(username, displayName) {
  return {
    id: makeId(),
    username,
    displayName,
    avatarColor: colorFromString(username)
  };
}

function renderCurrentUserHeader() {
  const me = getCurrentUser();
  if (!me) return;
  refs.myAvatar.style.background = me.avatarColor;
  refs.myAvatar.textContent = initials(me.displayName);
  refs.myDisplayName.textContent = me.displayName;
  refs.myUsername.textContent = "@" + me.username;
}

function renderContacts() {
  const qText = refs.searchUsers.value.trim().toLowerCase();
  const myId = state.currentUserId;
  const contacts = state.users
    .filter((u) => u.id !== myId)
    .filter((u) => {
      if (!qText) return true;
      return u.username.toLowerCase().includes(qText) || u.displayName.toLowerCase().includes(qText);
    });

  refs.contacts.innerHTML = "";

  if (!contacts.length) {
    const li = document.createElement("li");
    li.className = "contact-item";
    li.innerHTML = "<div class='contact-meta'><p class='name'>No contacts yet</p><p class='last-msg'>Create a new user to start chatting.</p></div>";
    refs.contacts.appendChild(li);
    return;
  }

  contacts.forEach((u) => {
    const li = document.createElement("li");
    li.className = "contact-item" + (state.activeChatUserId === u.id ? " active" : "");
    li.innerHTML =
      "<div class='avatar' style='background:" + u.avatarColor + "'>" + initials(u.displayName) + "</div>" +
      "<div class='contact-meta'>" +
      "<p class='name'>" + escapeHtml(u.displayName) + "</p>" +
      "<p class='last-msg'>@" + escapeHtml(u.username) + "</p>" +
      "</div>";

    li.addEventListener("click", () => {
      state.activeChatUserId = u.id;
      clearSelection();
      renderActiveChatHeader();
      renderContacts();
      renderMessages();
      refs.sidebar.classList.remove("open");
    });

    refs.contacts.appendChild(li);
  });
}

function renderActiveChatHeader() {
  const user = getActiveChatUser();
  if (!user) {
    refs.chatPartnerName.textContent = "Select a user";
    refs.chatPartnerHandle.textContent = "No conversation selected";
    refs.activeAvatar.textContent = "?";
    refs.activeAvatar.style.background = "#90a4ae";
    return;
  }

  refs.chatPartnerName.textContent = user.displayName;
  refs.chatPartnerHandle.textContent = "@" + user.username;
  refs.activeAvatar.style.background = user.avatarColor;
  refs.activeAvatar.textContent = initials(user.displayName);
}

function handleSendMessage() {
  const text = refs.messageInput.value.trim();
  if (!text || !state.activeChatUserId || !state.currentUserId) return;

  const message = {
    id: makeId(),
    from: state.currentUserId,
    to: state.activeChatUserId,
    text,
    timestamp: Date.now(),
    deletedForEveryone: false,
    deletedFor: []
  };

  state.messages.push(message);
  refs.messageInput.value = "";
  persistState();
  renderMessages();
}

function getConversationMessages() {
  if (!state.currentUserId || !state.activeChatUserId) return [];

  return state.messages
    .filter((m) => {
      const sameConversation =
        (m.from === state.currentUserId && m.to === state.activeChatUserId) ||
        (m.from === state.activeChatUserId && m.to === state.currentUserId);
      if (!sameConversation) return false;
      return !m.deletedFor.includes(state.currentUserId);
    })
    .sort((a, b) => a.timestamp - b.timestamp);
}

function renderMessages() {
  refs.messages.innerHTML = "";

  const activeUser = getActiveChatUser();
  if (!activeUser) {
    refs.messages.innerHTML = "<p class='empty-chat'>Create/select a contact and start chatting.</p>";
    return;
  }

  const messages = getConversationMessages();
  if (!messages.length) {
    refs.messages.innerHTML = "<p class='empty-chat'>No messages yet. Send the first message.</p>";
    return;
  }

  messages.forEach((m) => {
    const row = document.createElement("div");
    const sent = m.from === state.currentUserId;
    const isSelected = state.selectedMessageIds.has(m.id);
    row.className = "msg-row " + (sent ? "sent" : "received") + (isSelected ? " selected" : "");

    const text = m.deletedForEveryone ? "This message was deleted." : m.text;
    row.innerHTML =
      "<article class='msg' role='button' tabindex='0'>" +
      "<p class='msg-text'>" + escapeHtml(text) + "</p>" +
      "<p class='msg-time'>" + formatTime(m.timestamp) + "</p>" +
      "</article>";

    row.addEventListener("click", () => toggleMessageSelection(m.id));
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleMessageSelection(m.id);
      }
    });
    refs.messages.appendChild(row);
  });

  refs.messages.scrollTop = refs.messages.scrollHeight;
}

function toggleMessageSelection(id) {
  if (state.selectedMessageIds.has(id)) {
    state.selectedMessageIds.delete(id);
  } else {
    state.selectedMessageIds.add(id);
  }
  renderMessages();
  renderSelectionBar();
}

function clearSelection() {
  state.selectedMessageIds.clear();
  renderSelectionBar();
  renderMessages();
}

function renderSelectionBar() {
  const selectedCount = state.selectedMessageIds.size;
  refs.selectionBar.classList.toggle("hidden", selectedCount === 0);
  refs.selectedCount.textContent = String(selectedCount);
}

function deleteSelected(forEveryone) {
  if (!state.selectedMessageIds.size) return;
  const myId = state.currentUserId;

  state.messages = state.messages.map((m) => {
    if (!state.selectedMessageIds.has(m.id)) return m;

    if (forEveryone) {
      return {
        ...m,
        deletedForEveryone: true,
        text: "",
        deletedFor: []
      };
    }

    if (!m.deletedFor.includes(myId)) {
      return {
        ...m,
        deletedFor: [...m.deletedFor, myId]
      };
    }
    return m;
  });

  persistState();
  clearSelection();
}

function openMyProfile() {
  const me = getCurrentUser();
  if (!me) return;

  refs.profileAvatarMe.style.background = me.avatarColor;
  refs.profileAvatarMe.textContent = initials(me.displayName);
  refs.profileNameMe.textContent = me.displayName;
  refs.profileUserMe.textContent = "@" + me.username;
  refs.editDisplayName.value = me.displayName;
  refs.myProfileModal.classList.remove("hidden");
}

function saveProfile() {
  const me = getCurrentUser();
  if (!me) return;

  const nextName = refs.editDisplayName.value.trim();
  if (nextName) {
    me.displayName = nextName;
    state.users = state.users.map((u) => (u.id === me.id ? me : u));
    persistState();
  }

  refs.myProfileModal.classList.add("hidden");
  renderCurrentUserHeader();
  renderContacts();
  renderActiveChatHeader();
  renderMessages();
}

function openOtherProfile() {
  const other = getActiveChatUser();
  if (!other) return;

  refs.profileAvatarOther.style.background = other.avatarColor;
  refs.profileAvatarOther.textContent = initials(other.displayName);
  refs.profileNameOther.textContent = other.displayName;
  refs.profileUserOther.textContent = "@" + other.username;
  refs.otherProfileModal.classList.remove("hidden");
}

function switchToNextUser() {
  if (!state.users.length) return;
  if (!state.currentUserId) {
    state.currentUserId = state.users[0].id;
  } else {
    const idx = state.users.findIndex((u) => u.id === state.currentUserId);
    const nextIndex = (idx + 1) % state.users.length;
    state.currentUserId = state.users[nextIndex].id;
  }
  state.activeChatUserId = null;
  clearSelection();
  persistState();
  render();
}

function signOut() {
  localStorage.removeItem(KEYS.currentUserId);
  state.currentUserId = null;
  state.activeChatUserId = null;
  state.selectedMessageIds.clear();
  render();
}

function getCurrentUser() {
  return state.users.find((u) => u.id === state.currentUserId) || null;
}

function getActiveChatUser() {
  return state.users.find((u) => u.id === state.activeChatUserId) || null;
}

function readJson(key, fallback) {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch (err) {
    return fallback;
  }
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function initials(text) {
  if (!text) return "?";
  return text.trim().charAt(0).toUpperCase();
}

function colorFromString(str) {
  const palette = ["#6d4c41", "#00897b", "#3949ab", "#8e24aa", "#f4511e", "#546e7a", "#2e7d32"];
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return palette[Math.abs(hash) % palette.length];
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(unsafe) {
  return unsafe
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
