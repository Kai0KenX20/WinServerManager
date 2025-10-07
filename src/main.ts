import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';

import { logger } from './utils/logger';
import { DatabaseService } from './services/database';
import { ServerManager } from './services/serverManager';
import { SystemMonitor } from './services/systemMonitor';
import { WebSocketHandler } from './services/websocket';
import { AuthService } from './services/auth';

// Load environment variables
dotenv.config();

/**
 * WinServerManager - Main Application Class
 * 
 * A modern Windows server management application designed to be better than WindowsGSM.
 * Provides real-time monitoring, management, and control of game servers and applications.
 */
class WinServerManager {
    private app: express.Application;
    private httpServer: ReturnType<typeof createServer>;
    private wsServer: WebSocketServer;
    private port: number;
    
    // Core services
    private databaseService: DatabaseService;
    private serverManager: ServerManager;
    private systemMonitor: SystemMonitor;
    private websocketHandler: WebSocketHandler;
    private authService: AuthService;

    constructor() {
        this.port = parseInt(process.env.PORT || '3000');
        this.app = express();
        this.httpServer = createServer(this.app);
        this.wsServer = new WebSocketServer({ server: this.httpServer });
        
        // Initialize services
        this.databaseService = new DatabaseService();
        this.serverManager = new ServerManager(this.databaseService);
        this.systemMonitor = new SystemMonitor();
        this.authService = new AuthService();
        this.websocketHandler = new WebSocketHandler(this.wsServer);
        
        this.initializeMiddleware();
        this.initializeRoutes();
        this.initializeServices();
    }

    /**
     * Initialize Express middleware
     */
    private initializeMiddleware(): void {
        // Security middleware
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'"],
                    imgSrc: ["'self'", "data:", "https:"],
                },
            },
        }));

        // CORS configuration
        this.app.use(cors({
            origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
            credentials: true,
        }));

        // Body parsing middleware
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));

        // Static file serving
        this.app.use(express.static(path.join(__dirname, '../assets')));
        
        // Request logging
        this.app.use((req, res, next) => {
            logger.info(`${req.method} ${req.url}`, { 
                ip: req.ip, 
                userAgent: req.get('User-Agent') 
            });
            next();
        });
    }

    /**
     * Initialize API routes
     */
    private initializeRoutes(): void {
        // Health check endpoint
        this.app.get('/api/health', (req, res) => {
            res.json({
                status: 'OK',
                timestamp: new Date().toISOString(),
                version: process.env.npm_package_version || '0.1.0',
                uptime: process.uptime(),
            });
        });

        // Import and use API routes
        const { createAPIRoutes } = await import('./routes/api');
        const apiRoutes = createAPIRoutes(this.databaseService, this.serverManager, this.systemMonitor);
        this.app.use('/api', apiRoutes);

        // Serve the web interface
        this.app.get('*', (req, res) => {
            res.sendFile(path.join(__dirname, '../assets/index.html'));
        });

        // Global error handler
        this.app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
            logger.error('Unhandled error:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
            });
        });
    }

    /**
     * Initialize core services
     */
    private async initializeServices(): Promise<void> {
        try {
            logger.info('Initializing core services...');
            
            // Initialize database
            await this.databaseService.initialize();
            
            // Initialize other services
            await this.serverManager.initialize();
            await this.systemMonitor.initialize();
            await this.authService.initialize();
            
            // Set up WebSocket handlers
            this.websocketHandler.initialize();
            
            logger.info('All services initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize services:', error);
            process.exit(1);
        }
    }

    /**
     * Start the application server
     */
    public async start(): Promise<void> {
        try {
            await this.initializeServices();
            
            this.httpServer.listen(this.port, () => {
                logger.info(`🚀 WinServerManager started successfully!`);
                logger.info(`📡 HTTP Server: http://localhost:${this.port}`);
                logger.info(`🔌 WebSocket Server: ws://localhost:${this.port}`);
                logger.info(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
                logger.info(`📋 Process ID: ${process.pid}`);
            });

            // Graceful shutdown handling
            this.setupGracefulShutdown();
            
        } catch (error) {
            logger.error('Failed to start server:', error);
            process.exit(1);
        }
    }

    /**
     * Set up graceful shutdown handlers
     */
    private setupGracefulShutdown(): void {
        const shutdown = async (signal: string) => {
            logger.info(`Received ${signal}, initiating graceful shutdown...`);
            
            try {
                // Close HTTP server
                this.httpServer.close(() => {
                    logger.info('HTTP server closed');
                });

                // Close WebSocket server
                this.wsServer.close(() => {
                    logger.info('WebSocket server closed');
                });

                // Cleanup services
                await this.systemMonitor.cleanup();
                await this.serverManager.cleanup();
                await this.databaseService.cleanup();
                
                logger.info('Graceful shutdown completed');
                process.exit(0);
            } catch (error) {
                logger.error('Error during shutdown:', error);
                process.exit(1);
            }
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
        
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught exception:', error);
            shutdown('uncaughtException');
        });

        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled rejection at:', promise, 'reason:', reason);
            shutdown('unhandledRejection');
        });
    }
}

// Start the application if this file is run directly
if (require.main === module) {
    const app = new WinServerManager();
    app.start().catch((error) => {
        console.error('Failed to start WinServerManager:', error);
        process.exit(1);
    });
}

export default WinServerManager;