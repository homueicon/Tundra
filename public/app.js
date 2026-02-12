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
let selectedFile = null;
let dmContact = null;

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
  document.body.setAttribute('data-theme', userSettings.theme);
  document.body.setAttribute('data-font-size', userSettings.fontSize);
  document.documentElement.style.setProperty('--primary', userSettings.accentColor);
  
  if (userSettings.compactMode) {
    document.body.classList.add('compact-mode');
  } else {
    document.body.classList.remove('compact-mode');
  }
  
  const themeSelect = document.getElementById('themeSelect');
  const fontSizeSelect = document.getElementById('fontSizeSelect');
  const accentColorInput = document.getElementById('accentColor');
  
  if (themeSelect) themeSelect.value = userSettings.theme;
  if (fontSizeSelect) fontSizeSelect.value = userSettings.fontSize;
  if (accentColorInput) accentColorInput.value = userSettings.accentColor;
}

function showSettings() {
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
  
  loadAvatar();
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
  
  if (currentUser && displayName) {
    currentUser.display_name = displayName;
    document.getElementById('currentUsername').textContent = displayName;
  }
}

// Avatar Management
function uploadAvatar() {
  const input = document.getElementById('avatarUpload');
  const file = input.files[0];
  
  if (!file) return;
  
  if (!file.type.startsWith('image/')) {
    alert('Please select an image file');
    return;
  }
  
  if (file.size > 5 * 1024 * 1024) {
    alert('Image must be less than 5MB');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (e) => {
    const avatarUrl = e.target.result;
    
    const preview = document.getElementById('avatarPreview');
    preview.innerHTML = `<img src="${avatarUrl}" alt="Avatar">`;
    
    const mainAvatar = document.getElementById('userAvatar');
    mainAvatar.style.backgroundImage = `url(${avatarUrl})`;
    mainAvatar.style.backgroundSize = 'cover';
    mainAvatar.textContent = '';
    
    if (currentUser) {
      currentUser.avatar_url = avatarUrl;
      localStorage.setItem(`avatar_${currentUser.id}`, avatarUrl);
    }
  };
  
  reader.readAsDataURL(file);
}

function removeAvatar() {
  if (!currentUser) return;
  
  const preview = document.getElementById('avatarPreview');
  const initial = (currentUser.display_name || currentUser.username).charAt(0).toUpperCase();
  preview.innerHTML = `<span id="avatarPreviewText">${initial}</span>`;
  
  const mainAvatar = document.getElementById('userAvatar');
  mainAvatar.style.backgroundImage = '';
  mainAvatar.textContent = initial;
  
  localStorage.removeItem(`avatar_${currentUser.id}`);
  currentUser.avatar_url = null;
}

function loadAvatar() {
  if (!currentUser) return;
  
  const savedAvatar = localStorage.getItem(`avatar_${currentUser.id}`);
  const initial = (currentUser.display_name || currentUser.username).charAt(0).toUpperCase();
  
  const mainAvatar = document.getElementById('userAvatar');
  const preview = document.getElementById('avatarPreview');
  
  if (savedAvatar) {
    mainAvatar.style.backgroundImage = `url(${savedAvatar})`;
    mainAvatar.style.backgroundSize = 'cover';
    mainAvatar.textContent = '';
    
    if (preview) {
      preview.innerHTML = `<img src="${savedAvatar}" alt="Avatar">`;
    }
  } else {
    mainAvatar.textContent = initial;
    if (preview) {
      preview.innerHTML = `<span id="avatarPreviewText">${initial}</span>`;
    }
  }
}

// File Sharing
function attachFile() {
  document.getElementById('fileInput').click();
}

function handleFileSelect() {
  const input = document.getElementById('fileInput');
  const file = input.files[0];
  
  if (!file) return;
  
  if (file.size > 25 * 1024 * 1024) {
    alert('File must be less than 25MB');
    return;
  }
  
  selectedFile = file;
  
  const messageInput = document.getElementById('messageInput');
  messageInput.placeholder = `📎 ${file.name} (${formatFileSize(file.size)}) - Type message or press Send`;
  messageInput.style.borderColor = 'var(--primary)';
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

async function sendFileMessage() {
  if (!selectedFile || !currentRoom) return;
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    const fileData = {
      name: selectedFile.name,
      size: selectedFile.size,
      type: selectedFile.type,
      data: e.target.result
    };
    
    const messageContent = document.getElementById('messageInput').value.trim() || `Sent ${selectedFile.name}`;
    
    const result = await window.api.sendMessage({
      roomId: currentRoom.id,
      userId: currentUser.id,
      content: messageContent,
      messageType: 'file',
      fileData: JSON.stringify(fileData)
    });
    
    if (result.success) {
      selectedFile = null;
      document.getElementById('messageInput').value = '';
      document.getElementById('messageInput').placeholder = 'Type a message...';
      document.getElementById('messageInput').style.borderColor = '';
      document.getElementById('fileInput').value = '';
      await loadMessages();
    }
  };
  
  reader.readAsDataURL(selectedFile);
}

function getFileIcon(type) {
  if (type.includes('pdf')) return '📄';
  if (type.includes('word') || type.includes('document')) return '📝';
  if (type.includes('sheet') || type.includes('excel')) return '📊';
  if (type.includes('video')) return '🎥';
  if (type.includes('audio')) return '🎵';
  if (type.includes('zip') || type.includes('rar')) return '🗜️';
  return '📎';
}

function downloadFile(data, filename) {
  const link = document.createElement('a');
  link.href = data;
  link.download = filename;
  link.click();
}

// Direct Messaging
function showDMModal(contact) {
  dmContact = contact;
  document.getElementById('dmContactName').textContent = contact.display_name || contact.username;
  document.getElementById('dmModal').classList.add('active');
}

async function createDM() {
  if (!dmContact) return;
  
  console.log('Creating DM with contact:', dmContact);
  
  // Check if DM already exists between these two users
  const existingDM = rooms.find(r => 
    r.room_type === 'private' && 
    r.name.includes(currentUser.username) && 
    r.name.includes(dmContact.username)
  );
  
  if (existingDM) {
    console.log('Found existing DM:', existingDM);
    closeModal('dmModal');
    selectRoom(existingDM);
    return;
  }
  
  const roomName = `${currentUser.username} & ${dmContact.username}`;
  
  console.log('Creating new DM room:', roomName);
  
  const result = await window.api.createRoom({
    name: roomName,
    description: `Private conversation between ${currentUser.username} and ${dmContact.username}`,
    roomType: 'private',
    createdBy: currentUser.id
  });
  
  console.log('Create room result:', result);
  
  if (result.success) {
    console.log('Adding contact to room. Contact ID:', dmContact.id, 'Room ID:', result.room.id);
    
    // Add the contact as a member to the room
    const joinResult = await window.api.joinRoom(dmContact.id, result.room.id);
    console.log('Join room result:', joinResult);
    
    closeModal('dmModal');
    await loadRooms();
    
    // Select the newly created DM
    await new Promise(resolve => setTimeout(resolve, 300)); // Wait for rooms to load
    const newRoom = rooms.find(r => r.id === result.room.id);
    console.log('Found new room:', newRoom);
    
    if (newRoom) {
      selectRoom(newRoom);
    } else {
      console.error('Could not find newly created room in rooms list');
    }
  } else {
    alert('Failed to create DM: ' + result.error);
  }
}

// Invite to Room
function showInviteModal() {
  if (!currentRoom) {
    alert('Please select a room first');
    return;
  }
  
  document.getElementById('inviteRoomName').textContent = currentRoom.name;
  
  const container = document.getElementById('inviteContactsList');
  container.innerHTML = '';
  
  contacts.forEach(contact => {
    const item = document.createElement('div');
    item.className = 'invite-item';
    
    const userAvatar = localStorage.getItem(`avatar_${contact.id}`);
    const initial = (contact.display_name || contact.username).charAt(0).toUpperCase();
    
    const avatarStyle = userAvatar 
      ? `style="background-image: url(${userAvatar}); background-size: cover;"` 
      : '';
    const avatarText = userAvatar ? '' : initial;
    
    item.innerHTML = `
      <div class="invite-item-info">
        <div class="invite-item-avatar" ${avatarStyle}>${avatarText}</div>
        <div>
          <div style="font-weight: 600;">${contact.display_name || contact.username}</div>
          <div style="font-size: 12px; color: var(--text-muted);">@${contact.username}</div>
        </div>
      </div>
      <input type="checkbox" data-contact-id="${contact.id}">
    `;
    
    container.appendChild(item);
  });
  
  document.getElementById('inviteModal').classList.add('active');
}

async function sendInvites() {
  const checkboxes = document.querySelectorAll('#inviteContactsList input[type="checkbox"]:checked');
  
  if (checkboxes.length === 0) {
    alert('Please select at least one contact to invite');
    return;
  }
  
  const invitePromises = Array.from(checkboxes).map(cb => {
    const contactId = parseInt(cb.dataset.contactId);
    return window.api.joinRoom(contactId, currentRoom.id);
  });
  
  await Promise.all(invitePromises);
  
  closeModal('inviteModal');
  alert(`Invited ${checkboxes.length} contact(s) to ${currentRoom.name}`);
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
    showSettings();
  }
}

function playNotificationSound() {
  if (!userSettings.soundEnabled) return;
  
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

// Network listener - adapts to your own network automatically
function setupNetworkListener() {
  window.api.onLANServerStarted((info) => {
    networkInfo = info;
    showNetworkStatus(info);
    console.log(`LAN Server bound to network: ${info.ip}`);
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
    textEl.textContent = `🌐 LAN (${info.ip}:${info.port})`;
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
  
  document.getElementById('currentUsername').textContent = currentUser.display_name || currentUser.username;
  loadAvatar();
  
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
    
    // Determine room icon
    const isDM = room.room_type === 'private' && room.member_count === 2;
    const icon = isDM ? '💬' : (room.room_type === 'private' ? '🔒' : '👥');
    
    item.innerHTML = `
      <div class="list-item-title">${icon} ${room.name}</div>
      <div class="list-item-subtitle">${room.member_count} ${room.member_count === 1 ? 'member' : 'members'} • ${room.room_type}</div>
    `;
    
    item.onclick = () => selectRoom(room);
    roomsList.appendChild(item);
  });
}

async function selectRoom(room) {
  currentRoom = room;
  
  document.getElementById('currentRoomName').textContent = room.name;
  document.getElementById('messageInput').disabled = false;
  document.getElementById('sendButton').disabled = false;
  
  renderRooms();
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
    
    const userAvatar = localStorage.getItem(`avatar_${msg.user_id}`);
    if (userAvatar) {
      avatar.style.backgroundImage = `url(${userAvatar})`;
      avatar.style.backgroundSize = 'cover';
    } else {
      avatar.textContent = (msg.display_name || msg.username).charAt(0).toUpperCase();
    }
    
    const content = document.createElement('div');
    content.className = 'message-content';
    
    const time = new Date(msg.created_at).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const timestampHTML = userSettings.showTimestamps 
      ? `<span class="message-time">${time}</span>` 
      : '';
    
    let messageContent = '';
    
    if (msg.message_type === 'file' && msg.file_data) {
      const fileData = JSON.parse(msg.file_data);
      
      if (fileData.type.startsWith('image/')) {
        messageContent = `
          <div class="message-text">${escapeHtml(msg.content)}</div>
          <img src="${fileData.data}" class="message-image" onclick="window.open('${fileData.data}')" alt="${fileData.name}">
        `;
      } else {
        messageContent = `
          <div class="message-text">${escapeHtml(msg.content)}</div>
          <div class="message-file" onclick="downloadFile('${fileData.data}', '${fileData.name}')">
            <div class="message-file-icon">${getFileIcon(fileData.type)}</div>
            <div class="message-file-info">
              <div class="message-file-name">${fileData.name}</div>
              <div class="message-file-size">${formatFileSize(fileData.size)}</div>
            </div>
          </div>
        `;
      }
    } else {
      messageContent = `<div class="message-text">${escapeHtml(msg.content)}</div>`;
    }
    
    content.innerHTML = `
      <div class="message-header">
        <span class="message-author">${msg.display_name || msg.username}</span>
        ${timestampHTML}
      </div>
      ${messageContent}
    `;
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);
    container.appendChild(messageDiv);
  });
  
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
  
  if (selectedFile) {
    await sendFileMessage();
    return;
  }
  
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
  }
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
    item.style.position = 'relative';
    
    // Get avatar
    const userAvatar = localStorage.getItem(`avatar_${contact.id}`);
    const initial = (contact.display_name || contact.username).charAt(0).toUpperCase();
    
    let avatarHTML = '';
    if (userAvatar) {
      avatarHTML = `<div class="contact-avatar" style="background-image: url(${userAvatar}); background-size: cover;"></div>`;
    } else {
      avatarHTML = `<div class="contact-avatar">${initial}</div>`;
    }
    
    item.innerHTML = `
      ${avatarHTML}
      <div class="contact-info">
        <div class="list-item-title">${contact.display_name || contact.username}</div>
        <div class="list-item-subtitle">@${contact.username} • ${contact.status}</div>
      </div>
      <div class="contact-actions">
        <button class="contact-action-btn" onclick='event.stopPropagation(); showDMModal(${JSON.stringify(contact).replace(/'/g, "&#39;")})'>💬 Message</button>
      </div>
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
    searchUsers();
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
// Mimi got fucked here
