# Web Client Application

A desktop chat application built with Electron, featuring rooms, contacts, and PostgreSQL database integration.

## Features

- **User Authentication**: Register and login with encrypted passwords
- **Rooms**: Create and join chat rooms (public/private)
- **Contacts**: Add and manage contacts
- **Real-time Messaging**: Send and receive messages in rooms
- **PostgreSQL Database**: All data persisted in PostgreSQL

## Tech Stack

- **Electron**: Desktop application framework
- **PostgreSQL**: Database for storing users, rooms, contacts, and messages
- **bcrypt**: Password hashing
- **Node.js**: Backend runtime

## Prerequisites

1. **Node.js** (v16 or higher)
2. **PostgreSQL** (v12 or higher)

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup PostgreSQL Database

Install PostgreSQL and create a database:

```sql
CREATE DATABASE webclient;
```

### 3. Configure Database Connection

Edit `src/database/db.js` and update the PostgreSQL connection settings:

```javascript
const pool = new Pool({
  user: 'postgres',          // Your PostgreSQL username
  host: 'localhost',
  database: 'webclient',
  password: 'your_password', // Your PostgreSQL password
  port: 5432,
});
```

### 4. Run the Application

```bash
npm start
```

For development with DevTools:

```bash
npm run dev
```

## Project Structure

```
web-client/
├── src/
│   ├── main/
│   │   └── main.js           # Main Electron process
│   ├── preload/
│   │   └── preload.js        # Preload script for IPC
│   ├── database/
│   │   └── db.js             # PostgreSQL database operations
│   └── renderer/             # (Reserved for future renderer process files)
├── public/
│   ├── index.html            # Main HTML file
│   ├── styles.css            # Application styles
│   └── app.js                # Frontend JavaScript
├── assets/                   # Images, icons, etc.
└── package.json
```

## Database Schema

### Tables

- **users**: User accounts (id, username, email, password_hash, display_name, avatar_url, status)
- **contacts**: User contacts (user_id, contact_id)
- **rooms**: Chat rooms (id, name, description, room_type, created_by)
- **room_members**: Room membership (room_id, user_id, role)
- **messages**: Chat messages (id, room_id, user_id, content, created_at)

## Usage

1. **Register**: Create a new account
2. **Login**: Sign in with your credentials
3. **Create Room**: Click the + button in the Rooms tab
4. **Add Contacts**: Search and add users in the Contacts tab
5. **Chat**: Select a room and start messaging

## API Methods

Available through `window.api`:

- `login(credentials)` - User login
- `register(userData)` - User registration
- `getContacts(userId)` - Get user's contacts
- `addContact(userId, contactId)` - Add a contact
- `getRooms(userId)` - Get user's rooms
- `createRoom(roomData)` - Create a new room
- `joinRoom(userId, roomId)` - Join a room
- `getMessages(roomId)` - Get room messages
- `sendMessage(messageData)` - Send a message
- `searchUsers(query)` - Search for users

## Security Features

- Password hashing with bcrypt
- Context isolation in Electron
- IPC communication through preload script
- SQL injection prevention with parameterized queries

## Future Enhancements

- Real-time updates with WebSockets
- File sharing
- Voice/video calls
- Message reactions
- User presence indicators
- Push notifications

## License

MIT
