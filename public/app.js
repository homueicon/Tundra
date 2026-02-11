// Global state
let currentUser = null;
let currentRoom = null;
let rooms = [];
let contacts = [];
let networkInfo = null;
let userSettings = {
  theme: 'dark',
  accentColor: '#6366f1',
  fontSize: 'medium',
  soundEnabled: true,
  desktopNotifs: true,
  mentionOnly: false,
  enterToSend: true,
  showTimestamps: true,
  compactMode: false,
  autoSync: true,
  syncInterval: 30
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  setupLoginForm();
  setupRegisterForm();
  setupMessageInput();
  setupNetworkListener();
});

// Settings Management
function loadSettings() {
  const saved = localStorage.getItem('userSettings');
  if (saved) {
    userSettings = { ...userSettings, ...JSON.parse(saved) };
    applySettings();
  }
}

function saveSettings() {
  // Get values from UI
  userSettings.soundEnabled = document.getElementById('soundEnabled')?.checked ?? true;
  userSettings.desktopNotifs = document.getElementById('desktopNotifs')?.checked ?? true;
  userSettings.mentionOnly = document.getElementById('mentionOnly')?.checked ?? false;
  userSettings.enterToSend = document.getElementById('enterToSend')?.checked ?? true;
  userSettings.showTimestamps = document.getElementById('showTimestamps')?.checked ?? true;
  userSettings.autoSync = document.getElementById('autoSync')?.checked ?? true;
  userSettings.syncInterval = parseInt(document.getElementById('syncInterval')?.value ?? 30);
  
  localStorage.setItem('userSettings', JSON.stringify(userSettings));
  applySettings();
}

function applySettings() {
  // Apply theme
  document.body.setAttribute('data-theme', userSettings.theme);
  
  // Apply font size
  document.body.setAttribute('data-font-size', userSettings.fontSize);
  
  // Apply accent color
  document.documentElement.style.setProperty('--primary', userSettings.accentColor);
  
  // Apply compact mode
  if (userSettings.compactMode) {
    document.body.classList.add('compact-mode');
  } else {
    document.body.classList.remove('compact-mode');
  }
  
  // Update UI elements if settings modal is open
  const themeSelect = document.getElementById('themeSelect');
  const fontSizeSelect = document.getElementById('fontSizeSelect');
  const accentColorInput = document.getElementById('accentColor');
  
  if (themeSelect) themeSelect.value = userSettings.theme;
  if (fontSizeSelect) fontSizeSelect.value = userSettings.fontSize;
  if (accentColorInput) accentColorInput.value = userSettings.accentColor;
}

function showSettings() {
  // Populate settings modal with current values
  document.getElementById('themeSelect').value = userSettings.theme;
  document.getElementById('accentColor').value = userSettings.accentColor;
  document.getElementById('fontSizeSelect').value = userSettings.fontSize;
  document.getElementById('soundEnabled').checked = userSettings.soundEnabled;
  document.getElementById('desktopNotifs').checked = userSettings.desktopNotifs;
  document.getElementById('mentionOnly').checked = userSettings.mentionOnly;
  document.getElementById('enterToSend').checked = userSettings.enterToSend;
  document.getElementById('showTimestamps').checked = userSettings.showTimestamps;
  document.getElementById('compactMode').checked = userSettings.compactMode;
  document.getElementById('autoSync').checked = userSettings.autoSync;
  document.getElementById('syncInterval').value = userSettings.syncInterval;
  
  if (currentUser) {
    document.getElementById('profileDisplayName').value = currentUser.display_name || '';
  }
  
  document.getElementById('settingsModal').classList.add('active');
}

function changeTheme() {
  userSettings.theme = document.getElementById('themeSelect').value;
  saveSettings();
}

function changeAccentColor() {
  userSettings.accentColor = document.getElementById('accentColor').value;
  saveSettings();
}

function changeFontSize() {
  userSettings.fontSize = document.getElementById('fontSizeSelect').value;
  saveSettings();
}

function toggleCompactMode() {
  userSettings.compactMode = document.getElementById('compactMode').checked;
  saveSettings();
}

async function updateProfile() {
  const displayName = document.getElementById('profileDisplayName').value.trim();
  const statusMessage = document.getElementById('statusMessage').value.trim();
  
  if (currentUser && displayName) {
    // Update in database (you'd need to add this API)
    currentUser.display_name = displayName;
    document.getElementById('currentUsername').textContent = displayName;
  }
}

function resetSettings() {
  if (confirm('Reset all settings to default?')) {
    userSettings = {
      theme: 'dark',
      accentColor: '#6366f1',
      fontSize: 'medium',
      soundEnabled: true,
      desktopNotifs: true,
      mentionOnly: false,
      enterToSend: true,
      showTimestamps: true,
      compactMode: false,
      autoSync: true,
      syncInterval: 30
    };
    saveSettings();
    showSettings(); // Refresh modal
  }
}

function playNotificationSound() {
  if (!userSettings.soundEnabled) return;
  
  // Simple beep using Web Audio API
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.frequency.value = 800;
  oscillator.type = 'sine';
  
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.1);
}

function showDesktopNotification(title, body) {
  if (!userSettings.desktopNotifs) return;
  
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body: body,
      icon: '/assets/icon.png'
    });
  } else if ('Notification' in window && Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        new Notification(title, { body: body });
      }
    });
  }
}

// Network listener
function setupNetworkListener() {
  window.api.onLANServerStarted((info) => {
    networkInfo = info;
    showNetworkStatus(info);
  });
  
  // Auto-sync with configurable interval
  setInterval(async () => {
    if (currentUser && userSettings.autoSync) {
      await syncWithPeers();
    }
  }, userSettings.syncInterval * 1000);
}

function showNetworkStatus(info) {
  const statusEl = document.getElementById('networkStatus');
  const textEl = document.getElementById('networkStatusText');
  
  if (statusEl && textEl) {
    textEl.textContent = `Connected to LAN (${info.ip}:${info.port})`;
    statusEl.style.display = 'flex';
  }
}

async function syncWithPeers() {
  const result = await window.api.getPeers();
  if (result.success && result.peers.length > 0) {
    console.log(`Connected to ${result.peers.length} peer(s):`, result.peers);
    await window.api.syncNow();
  }
}

// Auth Forms
function setupLoginForm() {
  const form = document.getElementById('loginForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    
    const result = await window.api.login({ username, password });
    
    if (result.success) {
      currentUser = result.user;
      showAppScreen();
    } else {
      errorDiv.textContent = result.error;
    }
  });
}

function setupRegisterForm() {
  const form = document.getElementById('registerForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('regUsername').value;
    const email = document.getElementById('regEmail').value;
    const displayName = document.getElementById('regDisplayName').value;
    const password = document.getElementById('regPassword').value;
    const errorDiv = document.getElementById('registerError');
    
    const result = await window.api.register({
      username,
      email,
      displayName,
      password
    });
    
    if (result.success) {
      errorDiv.style.color = '#51cf66';
      errorDiv.textContent = 'Registration successful! Please login.';
      setTimeout(() => {
        showLoginForm();
      }, 1500);
    } else {
      errorDiv.style.color = '#ff6b6b';
      errorDiv.textContent = result.error;
    }
  });
}

function showLoginForm() {
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
  document.querySelectorAll('.tab')[0].classList.add('active');
  document.getElementById('loginForm').classList.add('active');
}

function showRegisterForm() {
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
  document.querySelectorAll('.tab')[1].classList.add('active');
  document.getElementById('registerForm').classList.add('active');
}

// App Screen
async function showAppScreen() {
  document.getElementById('loginScreen').classList.remove('active');
  document.getElementById('appScreen').classList.add('active');
  
  // Set user info
  document.getElementById('currentUsername').textContent = currentUser.display_name || currentUser.username;
  document.getElementById('userAvatar').textContent = (currentUser.display_name || currentUser.username).charAt(0).toUpperCase();
  
  // Load data
  await loadRooms();
  await loadContacts();
}

// Rooms
async function loadRooms() {
  const result = await window.api.getRooms(currentUser.id);
  
  if (result.success) {
    rooms = result.rooms;
    renderRooms();
  }
}

function renderRooms() {
  const roomsList = document.getElementById('roomsList');
  roomsList.innerHTML = '';
  
  if (rooms.length === 0) {
    roomsList.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">No rooms yet. Create one!</div>';
    return;
  }
  
  rooms.forEach(room => {
    const item = document.createElement('div');
    item.className = 'list-item';
    if (currentRoom && currentRoom.id === room.id) {
      item.classList.add('active');
    }
    
    item.innerHTML = `
      <div class="list-item-title">${room.name}</div>
      <div class="list-item-subtitle">${room.member_count} members • ${room.room_type}</div>
    `;
    
    item.onclick = () => selectRoom(room);
    roomsList.appendChild(item);
  });
}

async function selectRoom(room) {
  currentRoom = room;
  
  // Update UI
  document.getElementById('currentRoomName').textContent = room.name;
  document.getElementById('messageInput').disabled = false;
  document.getElementById('sendButton').disabled = false;
  
  // Highlight selected room
  renderRooms();
  
  // Load messages
  await loadMessages();
}

async function loadMessages() {
  if (!currentRoom) return;
  
  const result = await window.api.getMessages(currentRoom.id);
  
  if (result.success) {
    renderMessages(result.messages);
  }
}

function renderMessages(messages) {
  const container = document.getElementById('messagesContainer');
  container.innerHTML = '';
  
  messages.forEach(msg => {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    
    if (msg.user_id === currentUser.id) {
      messageDiv.classList.add('own');
    }
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = (msg.display_name || msg.username).charAt(0).toUpperCase();
    
    const content = document.createElement('div');
    content.className = 'message-content';
    
    const time = new Date(msg.created_at).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    content.innerHTML = `
      <div class="message-header">
        <span class="message-author">${msg.display_name || msg.username}</span>
        <span class="message-time">${time}</span>
      </div>
      <div class="message-text">${escapeHtml(msg.content)}</div>
    `;
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);
    container.appendChild(messageDiv);
  });
  
  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}

function setupMessageInput() {
  const input = document.getElementById('messageInput');
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (userSettings.enterToSend) {
        e.preventDefault();
        sendMessage();
      }
    }
  });
}

async function sendMessage() {
  if (!currentRoom) return;
  
  const input = document.getElementById('messageInput');
  const content = input.value.trim();
  
  if (!content) return;
  
  const result = await window.api.sendMessage({
    roomId: currentRoom.id,
    userId: currentUser.id,
    content
  });
  
  if (result.success) {
    input.value = '';
    await loadMessages();
    
    // Play sound for own message (optional)
    // playNotificationSound();
  }
}

// Modified renderMessages to add notifications
function renderMessages(messages) {
  const container = document.getElementById('messagesContainer');
  const previousCount = container.children.length;
  container.innerHTML = '';
  
  messages.forEach(msg => {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    
    if (msg.user_id === currentUser.id) {
      messageDiv.classList.add('own');
    }
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = (msg.display_name || msg.username).charAt(0).toUpperCase();
    
    const content = document.createElement('div');
    content.className = 'message-content';
    
    const time = new Date(msg.created_at).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const timestampHTML = userSettings.showTimestamps 
      ? `<span class="message-time">${time}</span>` 
      : '';
    
    content.innerHTML = `
      <div class="message-header">
        <span class="message-author">${msg.display_name || msg.username}</span>
        ${timestampHTML}
      </div>
      <div class="message-text">${escapeHtml(msg.content)}</div>
    `;
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);
    container.appendChild(messageDiv);
  });
  
  // Notify for new messages (not own)
  if (messages.length > previousCount) {
    const newMessages = messages.slice(previousCount);
    newMessages.forEach(msg => {
      if (msg.user_id !== currentUser.id) {
        playNotificationSound();
        if (!userSettings.mentionOnly || msg.content.includes(`@${currentUser.username}`)) {
          showDesktopNotification(
            `${msg.display_name || msg.username} in ${currentRoom.name}`,
            msg.content
          );
        }
      }
    });
  }
  
  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}

// Contacts
async function loadContacts() {
  const result = await window.api.getContacts(currentUser.id);
  
  if (result.success) {
    contacts = result.contacts;
    renderContacts();
  }
}

function renderContacts() {
  const contactsList = document.getElementById('contactsList');
  contactsList.innerHTML = '';
  
  if (contacts.length === 0) {
    contactsList.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">No contacts yet. Add some!</div>';
    return;
  }
  
  contacts.forEach(contact => {
    const item = document.createElement('div');
    item.className = 'list-item';
    
    item.innerHTML = `
      <div class="list-item-title">${contact.display_name || contact.username}</div>
      <div class="list-item-subtitle">@${contact.username} • ${contact.status}</div>
    `;
    
    contactsList.appendChild(item);
  });
}

// Modals
function showCreateRoomModal() {
  document.getElementById('createRoomModal').classList.add('active');
}

function showAddContactModal() {
  document.getElementById('addContactModal').classList.add('active');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

async function createRoom() {
  const name = document.getElementById('roomName').value.trim();
  const description = document.getElementById('roomDescription').value.trim();
  const roomType = document.getElementById('roomType').value;
  
  if (!name) {
    alert('Room name is required');
    return;
  }
  
  const result = await window.api.createRoom({
    name,
    description,
    roomType,
    createdBy: currentUser.id
  });
  
  if (result.success) {
    closeModal('createRoomModal');
    document.getElementById('roomName').value = '';
    document.getElementById('roomDescription').value = '';
    await loadRooms();
  } else {
    alert(result.error);
  }
}

let searchTimeout;
async function searchUsers() {
  const query = document.getElementById('searchUsersInput').value.trim();
  
  if (query.length < 2) {
    document.getElementById('searchResults').innerHTML = '';
    return;
  }
  
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async () => {
    const result = await window.api.searchUsers(query);
    
    if (result.success) {
      renderSearchResults(result.users);
    }
  }, 300);
}

function renderSearchResults(users) {
  const container = document.getElementById('searchResults');
  container.innerHTML = '';
  
  if (users.length === 0) {
    container.innerHTML = '<div style="padding: 10px; color: #666; text-align: center;">No users found</div>';
    return;
  }
  
  users.forEach(user => {
    if (user.id === currentUser.id) return;
    
    const isContact = contacts.some(c => c.id === user.id);
    
    const item = document.createElement('div');
    item.className = 'search-result-item';
    
    item.innerHTML = `
      <div>
        <div style="font-weight: 600;">${user.display_name || user.username}</div>
        <div style="font-size: 12px; color: #aaa;">@${user.username}</div>
      </div>
      <button onclick="addContact(${user.id})" ${isContact ? 'disabled' : ''}>
        ${isContact ? 'Added' : 'Add'}
      </button>
    `;
    
    container.appendChild(item);
  });
}

async function addContact(contactId) {
  const result = await window.api.addContact(currentUser.id, contactId);
  
  if (result.success) {
    await loadContacts();
    searchUsers(); // Refresh search results
  } else {
    alert(result.error);
  }
}

// Tabs
function showTab(tabName) {
  document.querySelectorAll('.sidebar-tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  
  if (tabName === 'rooms') {
    document.querySelectorAll('.sidebar-tab')[0].classList.add('active');
    document.getElementById('roomsTab').classList.add('active');
  } else if (tabName === 'contacts') {
    document.querySelectorAll('.sidebar-tab')[1].classList.add('active');
    document.getElementById('contactsTab').classList.add('active');
  }
}

function showRoomInfo() {
  if (currentRoom) {
    alert(`Room: ${currentRoom.name}\nDescription: ${currentRoom.description || 'No description'}\nType: ${currentRoom.room_type}\nMembers: ${currentRoom.member_count}`);
  }
}

// Utility
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Close modals on background click
document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
    }
  });
});