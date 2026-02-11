const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const db = require('../database/db');
const LANServer = require('../network/lan-server');

let mainWindow;
let lanServer;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    backgroundColor: '#0f172a',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1e293b',
      symbolColor: '#f1f5f9',
      height: 40
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../../public/index.html'));

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(async () => {
  try {
    // Initialize database
    await db.initialize();
    console.log('Database initialized');
    
    // Start LAN server
    lanServer = new LANServer(db.pool);
    const serverInfo = await lanServer.start();
    console.log(`LAN Server running on ${serverInfo.ip}:${serverInfo.port}`);
    
    createWindow();
    
    // Send server info to renderer
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow.webContents.send('lan-server-started', serverInfo);
    });
  } catch (err) {
    console.error('Initialization failed:', err);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (lanServer) {
    lanServer.stop();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (lanServer) {
    lanServer.stop();
  }
});

// IPC Handlers
ipcMain.handle('auth:login', async (event, credentials) => {
  return await db.login(credentials.username, credentials.password);
});

ipcMain.handle('auth:register', async (event, userData) => {
  const result = await db.register(userData);
  
  // Broadcast registration to LAN peers
  if (result.success && lanServer) {
    lanServer.broadcast('USER_REGISTER', {
      username: userData.username,
      email: userData.email,
      passwordHash: result.passwordHash,
      displayName: userData.displayName
    });
  }
  
  return result;
});

ipcMain.handle('contacts:getAll', async (event, userId) => {
  return await db.getContacts(userId);
});

ipcMain.handle('contacts:add', async (event, data) => {
  const result = await db.addContact(data.userId, data.contactId);
  
  // Broadcast to LAN peers
  if (result.success && lanServer) {
    lanServer.broadcast('CONTACT_ADD', data);
  }
  
  return result;
});

ipcMain.handle('contacts:remove', async (event, data) => {
  return await db.removeContact(data.userId, data.contactId);
});

ipcMain.handle('rooms:getAll', async (event, userId) => {
  return await db.getRooms(userId);
});

ipcMain.handle('rooms:create', async (event, roomData) => {
  const result = await db.createRoom(roomData);
  
  // Broadcast to LAN peers
  if (result.success && lanServer) {
    lanServer.broadcast('ROOM_CREATE', roomData);
  }
  
  return result;
});

ipcMain.handle('rooms:join', async (event, data) => {
  return await db.joinRoom(data.userId, data.roomId);
});

ipcMain.handle('rooms:leave', async (event, data) => {
  return await db.leaveRoom(data.userId, data.roomId);
});

ipcMain.handle('messages:get', async (event, roomId) => {
  return await db.getMessages(roomId);
});

ipcMain.handle('messages:send', async (event, messageData) => {
  const result = await db.sendMessage(messageData);
  
  // Broadcast to LAN peers
  if (result.success && lanServer) {
    lanServer.broadcast('MESSAGE', messageData);
  }
  
  return result;
});

ipcMain.handle('users:search', async (event, query) => {
  return await db.searchUsers(query);
});

ipcMain.handle('network:getPeers', async () => {
  if (lanServer) {
    return { success: true, peers: lanServer.getPeers() };
  }
  return { success: false, peers: [] };
});

ipcMain.handle('network:syncNow', async () => {
  if (lanServer) {
    lanServer.getPeers().forEach(peerIP => {
      const ws = lanServer.peers.get(peerIP);
      if (ws) {
        lanServer.requestSync(ws);
      }
    });
    return { success: true };
  }
  return { success: false };
});