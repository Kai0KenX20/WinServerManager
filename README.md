# 🚀 WinServerManager

A modern, powerful Windows server management application designed to be better than WindowsGSM. Built with TypeScript, Node.js, and modern web technologies.

## ✨ Features

### 🎮 Server Management
- **Multi-Server Support**: Manage multiple game servers (Minecraft, Steam games, etc.)
- **Real-time Monitoring**: Live CPU, memory, and network usage tracking
- **One-Click Controls**: Start, stop, restart servers with a single click
- **Auto-Installation**: Automated server installation and setup
- **Crash Recovery**: Automatic server restart on unexpected shutdowns
- **Plugin/Mod Management**: Install and manage server modifications
- **Backup System**: Automated and manual backup creation
- **Template System**: Pre-configured server templates

### 🌐 Web Interface
- **Modern UI**: Dark theme with beautiful gradients and animations
- **Real-time Dashboard**: Live system metrics and server status
- **Responsive Design**: Works perfectly on desktop, tablet, and mobile
- **WebSocket Updates**: Instant notifications and status changes
- **User Authentication**: Secure login system with role-based access
- **Session Management**: Secure session handling with auto-expiry

### 📊 System Monitoring
- **Resource Tracking**: CPU, Memory, Disk, and Network monitoring
- **Alert System**: Configurable alerts for system events
- **Performance Graphs**: Historical data visualization
- **Log Management**: Centralized logging with filtering and search
- **Process Monitoring**: Track all server processes and their resources

### 🔐 Security & Users
- **Role-Based Access**: Admin, Moderator, and User roles
- **Secure Authentication**: bcrypt password hashing
- **Session Security**: HTTP-only cookies and CSRF protection
- **Rate Limiting**: API endpoint protection
- **Audit Logging**: Track all user actions

## 🛠️ Installation

### Prerequisites
- **Node.js** 18.0 or higher
- **npm** 8.0 or higher
- **Windows** 10/11 or Windows Server 2019+
- **PowerShell** 5.1 or higher

### Quick Start
```bash
# Clone the repository
git clone https://github.com/Kai0KenX20/WinServerManager.git
cd WinServerManager

# Install dependencies
npm install

# Build the application
npm run build

# Start WinServerManager
npm start
```

### First Login
1. Open your browser to `http://localhost:8080`
2. Login with default credentials:
   - **Username**: `admin`
   - **Password**: `WinAdmin@2024`
3. **⚠️ Important**: Change the default password immediately!

## 🏗️ Architecture

WinServerManager follows a modern, modular architecture:

```
├── src/
│   ├── services/           # Core business logic
│   │   ├── database.ts     # SQLite database management
│   │   └── serverManager.ts # Server lifecycle management
│   ├── web/               # Web interface
│   │   ├── server.ts      # Express.js web server
│   │   ├── services/      # Web-specific services
│   │   ├── routes/        # API endpoints
│   │   └── public/        # Frontend assets
│   ├── types/             # TypeScript definitions
│   └── index.ts           # Application entry point
```

## 📚 API Documentation

### Authentication
```bash
# Login
POST /api/auth/login
Content-Type: application/json
{
  "username": "admin",
  "password": "password"
}

# Get current user
GET /api/auth/me

# Logout
POST /api/auth/logout
```

### Server Management
```bash
# List all servers
GET /api/servers

# Create new server
POST /api/servers
Content-Type: application/json
{
  "name": "My Minecraft Server",
  "type": "minecraft-java",
  "installPath": "C:\\GameServers\\Minecraft"
}

# Start/Stop/Restart server
POST /api/servers/{id}/start
POST /api/servers/{id}/stop
POST /api/servers/{id}/restart
```

### System Monitoring
```bash
# Get system stats
GET /api/system/stats

# Get system information
GET /api/system/info

# Get alerts
GET /api/system/alerts?limit=50&severity=warning
```

## 🔌 WebSocket Events

Real-time updates are provided via WebSocket:

```javascript
// Connect to WebSocket
const socket = io();

// Subscribe to events
socket.emit('subscribe', 'system-metrics');
socket.emit('subscribe', 'server-status');

// Listen for updates
socket.on('system-metrics', (data) => {
  console.log('System metrics:', data);
});

socket.on('server-status', (data) => {
  console.log('Server statuses:', data);
});
```

## 🧪 Development

### Development Setup
```bash
# Install dependencies
npm install

# Start in development mode
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

### Project Structure
- **`src/services/`** - Core business logic and server management
- **`src/web/`** - Web server, API routes, and frontend
- **`src/types/`** - TypeScript definitions
- **`src/utils/`** - Utility functions and helpers

### Adding New Server Types
1. Extend the `ServerType` enum in `src/types/index.ts`
2. Add server template in `data/templates/`
3. Implement server-specific logic in `ServerManager`
4. Update the UI dropdown in `src/web/public/index.html`

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Workflow
1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and add tests
4. Run the test suite: `npm test`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Express.js](https://expressjs.com/) and [Socket.IO](https://socket.io/)
- UI inspired by modern dashboard designs
- Icons by [Font Awesome](https://fontawesome.com/)
- Fonts by [Google Fonts](https://fonts.google.com/)

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/Kai0KenX20/WinServerManager/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Kai0KenX20/WinServerManager/discussions)
- **Documentation**: [Wiki](https://github.com/Kai0KenX20/WinServerManager/wiki)

---

**Made with ❤️ by the WinServerManager team**

*A modern alternative to WindowsGSM with enterprise-grade features and a beautiful interface.*