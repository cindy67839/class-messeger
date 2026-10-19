// ===== 1. CONNECT =====
const SUPABASE_URL = "https://xsimioerpihklehemhja.supabase.co";
const SUPABASE_KEY = "sb_publishable_SX4sA7tF0PPTA1v5DWnwEQ_Z0qgtL4l";

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== 2. ELEMENTS =====
const loginScreen = document.getElementById("loginScreen");
const chatScreen = document.getElementById("chatScreen");
const authForm = document.getElementById("authForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const displayNameInput = document.getElementById("displayName");
const authButton = document.getElementById("authButton");
const authToggle = document.getElementById("authToggle");
const authToggleText = authToggle?.querySelector("span");
const errorMessage = document.getElementById("errorMessage");
const myNameEl = document.getElementById("myName");
const logoutButton = document.getElementById("logoutButton");
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");
const messageList = document.getElementById("messageList");

let isSignUp = true;
let currentUser = null;

// ===== 3. TOGGLE LOGIN/SIGNUP =====
authToggleText?.addEventListener("click", () => {
  isSignUp = !isSignUp;
  authButton.textContent = isSignUp ? "Sign up" : "Log in";
  authToggleText.textContent = isSignUp ? "Log in" : "Sign up";
  displayNameInput.hidden = !isSignUp;
  errorMessage.textContent = "";
});

// ===== 4. AUTH =====
authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorMessage.textContent = "";

  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  const displayName = displayNameInput.value.trim();

  if (!email || !password) return showError("Fill in email & password!");
  if (isSignUp && !displayName) return showError("Enter your display name!");
  if (password.length < 6) return showError("Password needs at least 6 characters");

  try {
    let result;
    if (isSignUp) {
      result = await sb.auth.signUp({
        email, password,
        options: { data: { display_name: displayName } }
      });
    } else {
      result = await sb.auth.signInWithPassword({ email, password });
    }

    const { data, error } = result;
    if (error) throw error;
    if (!data.session) return showError("Check your email to confirm first!");

    currentUser = data.session.user;
    startChat();

  } catch (err) {
    console.error(err);
    showError(err.message);
  }
});

// ===== 5. START CHAT =====
function startChat() {
  myNameEl.textContent = currentUser.user_metadata?.display_name || currentUser.email;
  loginScreen.hidden = true;
  chatScreen.hidden = false;
  loadMessages();
  listenForNewMessages();
}

// ===== 6. DISPLAY MESSAGE =====
function addMessageToScreen(msg) {
  const div = document.createElement("div");
  div.style.padding = "10px 14px";
  div.style.margin = "6px 10px";
  div.style.borderRadius = "16px";
  div.style.maxWidth = "75%";
  div.style.lineHeight = "1.4";
  
  const isMe = msg.user_id === currentUser?.id;
  div.style.background = isMe ? "#0f5c6e" : "#eef2f5";
  div.style.color = isMe ? "white" : "inherit";
  div.style.marginLeft = isMe ? "auto" : "10px";
  div.style.borderBottomLeftRadius = isMe ? "16px" : "4px";
  div.style.borderBottomRightRadius = isMe ? "4px" : "16px";
  
  const sender = msg.profiles?.display_name || "Unknown";
  div.innerHTML = `<strong>${sender}:</strong><br>${msg.content}`;
  
  messageList.appendChild(div);
  messageList.scrollTop = messageList.scrollHeight;
}

// ===== 7. LOAD MESSAGES =====
async function loadMessages() {
  const { data, error } = await sb
    .from("messages")
    .select("*, profiles(display_name)")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Load error:", error);
    return;
  }
  
  messageList.innerHTML = "";
  data?.forEach(msg => addMessageToScreen(msg));
}

// ===== 8. SEND MESSAGE =====
messageForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text || !currentUser) return;

  // Weather command
  if (text.startsWith("/weather ")) {
    const city = text.slice(9).trim();
    addMessageToScreen({
      user_id: currentUser.id,
      content: text,
      profiles: { display_name: "You" }
    });
    messageInput.value = "";
    setTimeout(() => {
      addMessageToScreen({
        user_id: "bot",
        content: `📍 ${city}\n🌡️ 30°C ☀️ Clear\n💨 10 km/h`,
        profiles: { display_name: "Weather Bot" }
      });
    }, 300);
    return;
  }

  // Normal message
  const { error } = await sb.from("messages").insert({
    user_id: currentUser.id,
    content: text
  });

  if (error) {
    console.error("Send error:", error);
    alert("Error: " + error.message);
    return;
  }

  addMessageToScreen({
    user_id: currentUser.id,
    content: text,
    profiles: { display_name: "You" }
  });
  
  messageInput.value = "";
});

// ===== 9. REALTIME =====
function listenForNewMessages() {
  sb.channel("public:messages")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, async (payload) => {
      if (payload.new.user_id === currentUser?.id) return; // Skip own — already shown
      const { data } = await sb.from("messages").select("*, profiles(display_name)").eq("id", payload.new.id).single();
      if (data) addMessageToScreen(data);
    })
    .subscribe();
}

// ===== 10. LOGOUT =====
logoutButton.addEventListener("click", async () => {
  await sb.auth.signOut();
  currentUser = null;
  chatScreen.hidden = true;
  loginScreen.hidden = false;
  messageList.innerHTML = "";
  authForm.reset();
  isSignUp = true;
  authButton.textContent = "Sign up";
  authToggleText.textContent = "Log in";
  displayNameInput.hidden = false;
  errorMessage.textContent = "";
});

// ===== HELPERS =====
function showError(msg) {
  errorMessage.textContent = msg;
}

// ===== AUTO LOGIN =====
sb.auth.onAuthStateChange(async (_event, session) => {
  if (session?.user) {
    currentUser = session.user;
    startChat();
  }
});
