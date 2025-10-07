import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

import { ServerManager } from '../services/serverManager.js';
import { DatabaseService } from '../services/database.js';
import { SystemMonitor } from './services/systemMonitor.js';
import { WebSocketManager } from './services/websocketManager.js';
import { AuthService } from './services/authService.js';

// API Routes
import serverRoutes from './routes/servers.js';
import systemRoutes from './routes/system.js';
import authRoutes from './routes/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class WebServer {
    private app: express.Application;
    private server: any;
    private io: SocketIOServer;
    private serverManager: ServerManager;
    private database: DatabaseService;
    private systemMonitor: SystemMonitor;
    private wsManager: WebSocketManager;
    private authService: AuthService;
    private port: number;

    constructor(
        serverManager: ServerManager,
        database: DatabaseService,
        port: number = 8080
    ) {
        this.serverManager = serverManager;
        this.database = database;
        this.port = port;
        this.app = express();
        this.server = createServer(this.app);
        this.io = new SocketIOServer(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });

        this.systemMonitor = new SystemMonitor();
        this.wsManager = new WebSocketManager(this.io);
        this.authService = new AuthService(this.database);

        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
        this.startMonitoring();
    }

    private setupMiddleware(): void {
        // Security middleware
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'"],
                    imgSrc: ["'self'", "data:"],
                    connectSrc: ["'self'", "ws:", "wss:"]
                }
            }
        }));

        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100 // limit each IP to 100 requests per windowMs
        });
        this.app.use('/api/', limiter);

        // CORS
        this.app.use(cors());

        // Logging
        this.app.use(morgan('combined'));

        // Body parsing
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));

        // Session management
        this.app.use(session({
            secret: 'winservermanager-secret-key-change-in-production',
            resave: false,
            saveUninitialized: false,
            cookie: { 
                secure: false, // Set to true in production with HTTPS
                httpOnly: true,
                maxAge: 24 * 60 * 60 * 1000 // 24 hours
            }
        }));

        // Static files
        this.app.use(express.static(path.join(__dirname, 'public')));
    }

    private setupRoutes(): void {
        // Inject dependencies into route handlers
        this.app.use((req: any, res, next) => {
            req.serverManager = this.serverManager;
            req.database = this.database;
            req.authService = this.authService;
            next();
        });

        // API Routes
        this.app.use('/api/servers', serverRoutes);
        this.app.use('/api/system', systemRoutes);
        this.app.use('/api/auth', authRoutes);

        // Health check
        this.app.get('/api/health', (req, res) => {
            res.json({ 
                status: 'ok', 
                timestamp: new Date().toISOString(),
                uptime: process.uptime()
            });
        });

        // Serve the main dashboard
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        });

        // Handle 404
        this.app.use((req, res) => {
            res.status(404).json({ error: 'Not found' });
        });
    }

    private setupWebSocket(): void {
        this.io.use(async (socket, next) => {
            // Basic auth check for WebSocket connections
            const token = socket.handshake.auth.token;
            if (!token) {
                return next(new Error('Authentication required'));
            }
            // Add proper token validation here
            next();
        });

        this.io.on('connection', (socket) => {
            console.log('Client connected:', socket.id);
            this.wsManager.handleConnection(socket);

            socket.on('disconnect', () => {
                console.log('Client disconnected:', socket.id);
                this.wsManager.handleDisconnection(socket);
            });
        });
    }

    private startMonitoring(): void {
        // Start system monitoring
        this.systemMonitor.startMonitoring((metrics) => {
            this.wsManager.broadcastSystemMetrics(metrics);
        });

        // Monitor server status changes
        setInterval(async () => {
            const servers = await this.database.getServers();
            const serverStatuses = await Promise.all(
                servers.map(async (server) => {
                    const isRunning = await this.serverManager.isServerRunning(server.id);
                    const metrics = isRunning ? await this.serverManager.getServerMetrics(server.id) : null;
                    
                    return {
                        id: server.id,
                        name: server.name,
                        status: isRunning ? 'running' : 'stopped',
                        metrics: metrics
                    };
                })
            );

            this.wsManager.broadcastServerStatuses(serverStatuses);
        }, 5000); // Update every 5 seconds
    }

    public async start(): Promise<void> {
        return new Promise((resolve) => {
            this.server.listen(this.port, () => {
                console.log(`WinServerManager Web Interface running on http://localhost:${this.port}`);
                resolve();
            });
        });
    }

    public async stop(): Promise<void> {
        this.systemMonitor.stopMonitoring();
        return new Promise((resolve) => {
            this.server.close(() => {
                console.log('Web server stopped');
                resolve();
            });
        });
    }
}