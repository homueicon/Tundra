const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'webclient',
  password: 'your_password',
  port: 5432,
});

async function initialize() {
  const client = await pool.connect();
  
  try {
    // Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        display_name VARCHAR(100),
        avatar_url VARCHAR(255),
        status VARCHAR(20) DEFAULT 'offline',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        contact_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, contact_id)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        room_type VARCHAR(20) DEFAULT 'public',
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        avatar_url VARCHAR(255)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS room_members (
        id SERIAL PRIMARY KEY,
        room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(20) DEFAULT 'member',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(room_id, user_id)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        content TEXT NOT NULL,
        message_type VARCHAR(20) DEFAULT 'text',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        edited_at TIMESTAMP,
        is_deleted BOOLEAN DEFAULT false
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id);
      CREATE INDEX IF NOT EXISTS idx_room_members ON room_members(room_id, user_id);
    `);

    console.log('Database tables created successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Authentication
async function register(userData) {
  const { username, email, password, displayName } = userData;
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, display_name) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, username, email, display_name, created_at`,
      [username, email, hashedPassword, displayName || username]
    );
    
    return { success: true, user: result.rows[0] };
  } catch (error) {
    if (error.code === '23505') {
      return { success: false, error: 'Username or email already exists' };
    }
    return { success: false, error: error.message };
  }
}

async function login(username, password) {
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    
    if (result.rows.length === 0) {
      return { success: false, error: 'Invalid username or password' };
    }
    
    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!validPassword) {
      return { success: false, error: 'Invalid username or password' };
    }
    
    await pool.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP, status = $1 WHERE id = $2',
      ['online', user.id]
    );
    
    delete user.password_hash;
    return { success: true, user };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Contacts
async function getContacts(userId) {
  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.status, c.added_at
       FROM contacts c
       JOIN users u ON c.contact_id = u.id
       WHERE c.user_id = $1
       ORDER BY u.display_name`,
      [userId]
    );
    
    return { success: true, contacts: result.rows };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function addContact(userId, contactId) {
  try {
    await pool.query(
      'INSERT INTO contacts (user_id, contact_id) VALUES ($1, $2)',
      [userId, contactId]
    );
    
    return { success: true };
  } catch (error) {
    if (error.code === '23505') {
      return { success: false, error: 'Contact already added' };
    }
    return { success: false, error: error.message };
  }
}

async function removeContact(userId, contactId) {
  try {
    await pool.query(
      'DELETE FROM contacts WHERE user_id = $1 AND contact_id = $2',
      [userId, contactId]
    );
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Rooms
async function getRooms(userId) {
  try {
    const result = await pool.query(
      `SELECT r.*, rm.role, rm.joined_at,
        (SELECT COUNT(*) FROM room_members WHERE room_id = r.id) as member_count
       FROM rooms r
       JOIN room_members rm ON r.id = rm.room_id
       WHERE rm.user_id = $1
       ORDER BY r.name`,
      [userId]
    );
    
    return { success: true, rooms: result.rows };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function createRoom(roomData) {
  const { name, description, roomType, createdBy } = roomData;
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const roomResult = await client.query(
      `INSERT INTO rooms (name, description, room_type, created_by) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [name, description, roomType || 'public', createdBy]
    );
    
    const room = roomResult.rows[0];
    
    await client.query(
      'INSERT INTO room_members (room_id, user_id, role) VALUES ($1, $2, $3)',
      [room.id, createdBy, 'admin']
    );
    
    await client.query('COMMIT');
    
    return { success: true, room };
  } catch (error) {
    await client.query('ROLLBACK');
    return { success: false, error: error.message };
  } finally {
    client.release();
  }
}

async function joinRoom(userId, roomId) {
  try {
    await pool.query(
      'INSERT INTO room_members (room_id, user_id) VALUES ($1, $2)',
      [roomId, userId]
    );
    
    return { success: true };
  } catch (error) {
    if (error.code === '23505') {
      return { success: false, error: 'Already a member of this room' };
    }
    return { success: false, error: error.message };
  }
}

async function leaveRoom(userId, roomId) {
  try {
    await pool.query(
      'DELETE FROM room_members WHERE room_id = $1 AND user_id = $2',
      [roomId, userId]
    );
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Messages
async function getMessages(roomId, limit = 100) {
  try {
    const result = await pool.query(
      `SELECT m.*, u.username, u.display_name, u.avatar_url
       FROM messages m
       JOIN users u ON m.user_id = u.id
       WHERE m.room_id = $1 AND m.is_deleted = false
       ORDER BY m.created_at DESC
       LIMIT $2`,
      [roomId, limit]
    );
    
    return { success: true, messages: result.rows.reverse() };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function sendMessage(messageData) {
  const { roomId, userId, content, messageType } = messageData;
  
  try {
    const result = await pool.query(
      `INSERT INTO messages (room_id, user_id, content, message_type) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [roomId, userId, content, messageType || 'text']
    );
    
    return { success: true, message: result.rows[0] };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Users
async function searchUsers(query) {
  try {
    const result = await pool.query(
      `SELECT id, username, display_name, avatar_url, status
       FROM users
       WHERE username ILIKE $1 OR display_name ILIKE $1
       LIMIT 20`,
      [`%${query}%`]
    );
    
    return { success: true, users: result.rows };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = {
  pool,
  initialize,
  query: (text, params) => pool.query(text, params),
  register,
  login,
  getContacts,
  addContact,
  removeContact,
  getRooms,
  createRoom,
  joinRoom,
  leaveRoom,
  getMessages,
  sendMessage,
  searchUsers
};