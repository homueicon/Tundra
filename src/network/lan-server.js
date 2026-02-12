const WebSocket = require('ws');
const dgram = require('dgram');
const os = require('os');

class LANServer {
  constructor(db) {
    this.db = db;
    this.wss = null;
    this.port = 8765;
    this.discoveryPort = 8766;
    this.udpSocket = null;
    this.peers = new Map(); // Connected peers
    this.syncQueue = []; // Offline sync queue
  }

  // Get local IP address
  getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    return 'localhost';
  }

  // Start WebSocket server
  start() {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocket.Server({ port: this.port });
        
        this.wss.on('connection', (ws, req) => {
          const peerIP = req.socket.remoteAddress;
          console.log(`Peer connected: ${peerIP}`);
          
          this.peers.set(peerIP, ws);
          
          ws.on('message', async (data) => {
            await this.handleMessage(ws, peerIP, data);
          });
          
          ws.on('close', () => {
            console.log(`Peer disconnected: ${peerIP}`);
            this.peers.delete(peerIP);
          });
          
          ws.on('error', (error) => {
            console.error(`WebSocket error with ${peerIP}:`, error);
          });
        });
        
        // Start UDP discovery
        this.startDiscovery();
        
        const localIP = this.getLocalIP();
        console.log(`LAN Server started on ${localIP}:${this.port}`);
        resolve({ ip: localIP, port: this.port });
      } catch (error) {
        reject(error);
      }
    });
  }

  // Start UDP broadcast for peer discovery
  startDiscovery() {
    this.udpSocket = dgram.createSocket('udp4');
    
    this.udpSocket.bind(this.discoveryPort, () => {
      this.udpSocket.setBroadcast(true);
    });
    
    // Listen for discovery messages
    this.udpSocket.on('message', (msg, rinfo) => {
      try {
        const data = JSON.parse(msg.toString());
        if (data.type === 'DISCOVERY' && rinfo.address !== this.getLocalIP()) {
          console.log(`Discovered peer: ${rinfo.address}:${data.port}`);
          this.connectToPeer(rinfo.address, data.port);
        }
      } catch (error) {
        // Ignore invalid messages
      }
    });
    
    // Broadcast presence every 10 seconds
    this.discoveryInterval = setInterval(() => {
      this.broadcast();
    }, 10000);
    
    // Initial broadcast
    this.broadcast();
  }

  // Broadcast presence on LAN
  broadcast() {
    const message = JSON.stringify({
      type: 'DISCOVERY',
      port: this.port,
      timestamp: Date.now()
    });
    
    this.udpSocket.send(message, this.discoveryPort, '255.255.255.255', (err) => {
      if (err) console.error('Broadcast error:', err);
    });
  }

  // Connect to discovered peer
  connectToPeer(ip, port) {
    if (this.peers.has(ip)) return; // Already connected
    
    try {
      const ws = new WebSocket(`ws://${ip}:${port}`);
      
      ws.on('open', () => {
        console.log(`Connected to peer: ${ip}:${port}`);
        this.peers.set(ip, ws);
        
        // Request initial sync
        this.requestSync(ws);
      });
      
      ws.on('message', async (data) => {
        await this.handleMessage(ws, ip, data);
      });
      
      ws.on('close', () => {
        console.log(`Disconnected from peer: ${ip}`);
        this.peers.delete(ip);
      });
      
      ws.on('error', (error) => {
        console.error(`Connection error with ${ip}:`, error);
      });
    } catch (error) {
      console.error(`Failed to connect to ${ip}:`, error);
    }
  }

  // Handle incoming messages
  async handleMessage(ws, peerIP, data) {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'SYNC_REQUEST':
          await this.handleSyncRequest(ws, message);
          break;
        case 'SYNC_DATA':
          await this.handleSyncData(message);
          break;
        case 'MESSAGE':
          await this.handleNewMessage(message);
          this.broadcastToPeers(message, peerIP);
          break;
        case 'USER_REGISTER':
          await this.handleUserRegister(message);
          this.broadcastToPeers(message, peerIP);
          break;
        case 'ROOM_CREATE':
          await this.handleRoomCreate(message);
          this.broadcastToPeers(message, peerIP);
          break;
        case 'CONTACT_ADD':
          await this.handleContactAdd(message);
          this.broadcastToPeers(message, peerIP);
          break;
        default:
          console.log(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  }

  // Request initial sync from peer
  requestSync(ws) {
    const message = {
      type: 'SYNC_REQUEST',
      timestamp: Date.now()
    };
    ws.send(JSON.stringify(message));
  }

  // Handle sync request
  async handleSyncRequest(ws, message) {
    try {
      // Get all data from database
      const users = await this.db.query('SELECT * FROM users');
      const rooms = await this.db.query('SELECT * FROM rooms');
      const contacts = await this.db.query('SELECT * FROM contacts');
      const messages = await this.db.query('SELECT * FROM messages WHERE created_at > NOW() - INTERVAL \'7 days\'');
      
      const syncData = {
        type: 'SYNC_DATA',
        data: {
          users: users.rows,
          rooms: rooms.rows,
          contacts: contacts.rows,
          messages: messages.rows
        },
        timestamp: Date.now()
      };
      
      ws.send(JSON.stringify(syncData));
    } catch (error) {
      console.error('Error handling sync request:', error);
    }
  }

  // Handle incoming sync data
  async handleSyncData(message) {
    try {
      const { users, rooms, contacts, messages } = message.data;
      
      // Sync users (avoid duplicates)
      for (const user of users) {
        await this.db.query(
          `INSERT INTO users (id, username, email, password_hash, display_name, avatar_url, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET
           display_name = EXCLUDED.display_name,
           avatar_url = EXCLUDED.avatar_url,
           status = EXCLUDED.status`,
          [user.id, user.username, user.email, user.password_hash, user.display_name, user.avatar_url, user.status, user.created_at]
        );
      }
      
      // Sync rooms
      for (const room of rooms) {
        await this.db.query(
          `INSERT INTO rooms (id, name, description, room_type, created_by, created_at, avatar_url)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO UPDATE SET
           description = EXCLUDED.description,
           avatar_url = EXCLUDED.avatar_url`,
          [room.id, room.name, room.description, room.room_type, room.created_by, room.created_at, room.avatar_url]
        );
      }
      
      // Sync contacts
      for (const contact of contacts) {
        await this.db.query(
          `INSERT INTO contacts (user_id, contact_id, added_at)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, contact_id) DO NOTHING`,
          [contact.user_id, contact.contact_id, contact.added_at]
        );
      }
      
      // Sync messages
      for (const msg of messages) {
        await this.db.query(
          `INSERT INTO messages (id, room_id, user_id, content, message_type, created_at, edited_at, is_deleted)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO NOTHING`,
          [msg.id, msg.room_id, msg.user_id, msg.content, msg.message_type, msg.created_at, msg.edited_at, msg.is_deleted]
        );
      }
      
      console.log('Sync completed successfully');
    } catch (error) {
      console.error('Error syncing data:', error);
    }
  }

  // Handle new message
  async handleNewMessage(message) {
    try {
      await this.db.query(
        `INSERT INTO messages (room_id, user_id, content, message_type, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [message.data.roomId, message.data.userId, message.data.content, message.data.messageType || 'text', new Date()]
      );
    } catch (error) {
      console.error('Error saving message:', error);
    }
  }

  // Handle user registration
  async handleUserRegister(message) {
    try {
      await this.db.query(
        `INSERT INTO users (username, email, password_hash, display_name)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (username) DO NOTHING`,
        [message.data.username, message.data.email, message.data.passwordHash, message.data.displayName]
      );
    } catch (error) {
      console.error('Error syncing user registration:', error);
    }
  }

  // Handle room creation
  async handleRoomCreate(message) {
    try {
      await this.db.query(
        `INSERT INTO rooms (name, description, room_type, created_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [message.data.name, message.data.description, message.data.roomType, message.data.createdBy]
      );
    } catch (error) {
      console.error('Error syncing room creation:', error);
    }
  }

  // Handle contact add
  async handleContactAdd(message) {
    try {
      await this.db.query(
        `INSERT INTO contacts (user_id, contact_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [message.data.userId, message.data.contactId]
      );
    } catch (error) {
      console.error('Error syncing contact add:', error);
    }
  }

  // Broadcast message to all peers except sender
  broadcastToPeers(message, excludeIP = null) {
    const data = JSON.stringify(message);
    this.peers.forEach((ws, ip) => {
      if (ip !== excludeIP && ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });
  }

  // Send message to specific peer
  sendToPeer(ip, message) {
    const ws = this.peers.get(ip);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  // Broadcast event to all peers
  broadcast(type, data) {
    const message = {
      type,
      data,
      timestamp: Date.now()
    };
    this.broadcastToPeers(message);
  }

  // Get connected peers
  getPeers() {
    return Array.from(this.peers.keys());
  }

  // Stop server
  stop() {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
    }
    
    if (this.udpSocket) {
      this.udpSocket.close();
    }
    
    if (this.wss) {
      this.wss.close();
    }
    
    this.peers.clear();
    console.log('LAN Server stopped');
  }
}

module.exports = LANServer;

// Mimi was here :3
