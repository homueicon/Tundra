const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Authentication
  login: (credentials) => ipcRenderer.invoke('auth:login', credentials),
  register: (userData) => ipcRenderer.invoke('auth:register', userData),
  
  // Contacts
  getContacts: (userId) => ipcRenderer.invoke('contacts:getAll', userId),
  addContact: (userId, contactId) => ipcRenderer.invoke('contacts:add', { userId, contactId }),
  removeContact: (userId, contactId) => ipcRenderer.invoke('contacts:remove', { userId, contactId }),
  
  // Rooms
  getRooms: (userId) => ipcRenderer.invoke('rooms:getAll', userId),
  createRoom: (roomData) => ipcRenderer.invoke('rooms:create', roomData),
  joinRoom: (userId, roomId) => ipcRenderer.invoke('rooms:join', { userId, roomId }),
  leaveRoom: (userId, roomId) => ipcRenderer.invoke('rooms:leave', { userId, roomId }),
  
  // Messages
  getMessages: (roomId) => ipcRenderer.invoke('messages:get', roomId),
  sendMessage: (messageData) => ipcRenderer.invoke('messages:send', messageData),
  
  // Users
  searchUsers: (query) => ipcRenderer.invoke('users:search', query),
  
  // Network/LAN
  getPeers: () => ipcRenderer.invoke('network:getPeers'),
  syncNow: () => ipcRenderer.invoke('network:syncNow'),
  
  // Event listeners
  onLANServerStarted: (callback) => {
    ipcRenderer.on('lan-server-started', (event, data) => callback(data));
  }
});