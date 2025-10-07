# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

**WinServerManager** is a modern, powerful Windows server management application designed to be significantly better than WindowsGSM. It provides comprehensive server management capabilities with a beautiful web interface, real-time monitoring, and advanced automation features.

### Key Features
- **Multi-server Support**: Minecraft (Vanilla, Forge, Fabric, Paper, Spigot), Steam games (CS2, GMod, TF2, etc.), and custom servers
- **Modern Web Interface**: Responsive design with real-time updates via Socket.IO
- **Advanced Monitoring**: CPU, memory, disk, network monitoring with historical data and alerts
- **Automated Management**: Server installation, updates, backups, and crash recovery
- **Plugin System**: Extensible architecture for custom server types and modifications
- **Security**: Role-based access control and secure authentication
- **Better UX**: Intuitive interface that's far superior to WindowsGSM

## Architecture

### Core Components

1. **ServerManager** (`src/services/serverManager.ts`)
   - Comprehensive server lifecycle management
   - Template-based server creation with pre-configured setups
   - Process monitoring with resource tracking
   - Auto-restart and crash detection
   - Plugin and mod management

2. **DatabaseService** (`src/services/database.ts`)
   - SQLite-based data persistence with optimized schemas
   - Server configurations, logs, backups, and metrics storage
   - Indexed queries for performance
   - Automatic migrations

3. **SystemMonitor** (`src/services/systemMonitor.ts`)
   - Real-time system metrics collection using systeminformation
   - Resource usage tracking and alerts
   - Historical data collection
   - Performance optimization recommendations

4. **WebSocket Handler** (`src/services/websocket.ts`)
   - Real-time communication between server and web client
   - Live server status updates
   - System metrics broadcasting
   - Event-driven architecture

### Technology Stack
- **Backend**: Node.js + TypeScript + Express
- **Database**: SQLite with comprehensive schemas
- **Frontend**: Modern HTML5 + TailwindCSS + Socket.IO client
- **Monitoring**: systeminformation library for system metrics
- **Process Management**: Advanced child_process management
- **Security**: Helmet, CORS, input validation

## Development Commands

### Environment Setup
```bash
# Install dependencies
npm install

# Development with auto-reload
npm run dev

# Production build
npm run build

# Start production server
npm start
```

### Testing and Quality
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

### Database Operations
```bash
# Database is automatically initialized on first run
# Located at: ./data/winservermanager.db

# Manual database operations (if needed)
# The DatabaseService handles schema creation and migrations automatically
```

## Server Templates

The application includes pre-configured server templates:

### Minecraft Servers
- **Vanilla**: Official Minecraft server with automatic EULA acceptance
- **Forge/Fabric**: Modded server support with mod management
- **Paper/Spigot**: Performance-optimized servers with plugin support

### Steam Game Servers
- **Counter-Strike 2**: Dedicated server with SourceMod support
- **Garry's Mod**: Workshop integration and addon management
- **Team Fortress 2**: Classic multiplayer setup
- **Rust**: Survival server with customization options

### Custom Servers
- Extensible template system for any server type
- Configurable installation steps and dependencies
- Port management and configuration templates

## Configuration

### Server Configuration Structure
```typescript
interface ServerConfig {
  serverProperties?: Record<string, string | number | boolean>;
  startupParameters?: string[];
  javaArgs?: string[];
  memoryAllocation?: { min: string; max: string; };
  networking?: {
    port: number;
    queryPort?: number;
    rconPort?: number;
    rconPassword?: string;
  };
  world?: {
    name: string;
    seed?: string;
    gamemode?: string;
    difficulty?: string;
  };
  performance?: {
    maxPlayers: number;
    viewDistance: number;
    simulationDistance: number;
  };
}
```

### System Requirements
- **Node.js**: ≥16.0.0
- **NPM**: ≥8.0.0
- **Memory**: 4GB+ recommended
- **Disk Space**: 10GB+ for server files
- **OS**: Windows 10/11, Windows Server 2016+

## API Endpoints

### Server Management
- `GET /api/servers` - List all servers
- `POST /api/servers` - Create new server
- `GET /api/servers/:id` - Get server details
- `POST /api/servers/:id/start` - Start server
- `POST /api/servers/:id/stop` - Stop server
- `DELETE /api/servers/:id` - Delete server

### System Monitoring
- `GET /api/system/metrics` - Current system metrics
- `GET /api/health` - System health check

### Templates and Logs
- `GET /api/templates` - Available server templates
- `GET /api/servers/:id/logs` - Server logs
- `POST /api/servers/:id/backup` - Create backup

## File Structure

```
src/
├── services/           # Core business logic
│   ├── serverManager.ts    # Server lifecycle management
│   ├── database.ts         # Data persistence layer
│   ├── systemMonitor.ts    # System metrics collection
│   ├── websocket.ts        # Real-time communication
│   └── auth.ts            # Authentication service
├── routes/            # API route definitions
│   └── api.ts             # RESTful API endpoints
├── types/             # TypeScript type definitions
│   └── index.ts           # Core interfaces and enums
├── utils/             # Utility functions
│   └── logger.ts          # Centralized logging
└── main.ts            # Application entry point

assets/
└── index.html         # Web interface

data/                  # Runtime data directory
├── winservermanager.db    # SQLite database
└── servers/              # Server installation directories
```

## Extending the Application

### Adding New Server Types
1. Define server template in `ServerManager.loadServerTemplates()`
2. Add corresponding `ServerType` enum value
3. Implement specific installation steps and configuration
4. Add template to web interface

### Plugin Development
The application supports plugins for extending functionality:
- Custom server types
- Additional monitoring metrics
- Integration with external services
- Custom web interface components

### Security Considerations
- All user inputs are validated and sanitized
- Database queries use parameterized statements
- File operations are restricted to designated directories
- Process execution is controlled and monitored
- Web interface includes CSRF protection

## Troubleshooting

### Common Issues
1. **Port conflicts**: Check if ports are already in use
2. **Permission errors**: Ensure write access to server directories
3. **Java not found**: Install Java JDK for Minecraft servers
4. **Database locked**: Restart application if SQLite is locked

### Logging
- Application logs are available in the console and web interface
- Server-specific logs are stored per server and accessible via API
- System metrics are logged for performance analysis

### Performance Optimization
- System monitoring can be adjusted via thresholds
- Database queries are indexed for performance
- WebSocket connections are efficiently managed
- Server processes are monitored for resource usage

## Comparison with WindowsGSM

**WinServerManager Advantages:**
- ✅ Modern, responsive web interface
- ✅ Real-time system monitoring and alerts
- ✅ Advanced server templates with auto-configuration
- ✅ Comprehensive backup and restore system
- ✅ Plugin and mod management
- ✅ Better process monitoring and crash recovery
- ✅ RESTful API for automation
- ✅ TypeScript for better code quality
- ✅ Socket.IO for real-time updates
- ✅ Comprehensive logging and metrics
- ✅ Role-based access control (planned)
- ✅ Better resource management

**WindowsGSM Limitations:**
- ❌ Outdated WinForms interface
- ❌ Limited monitoring capabilities
- ❌ Manual server configuration
- ❌ Basic backup system
- ❌ Limited automation
- ❌ Poor resource tracking
- ❌ No web interface
- ❌ Limited extensibility