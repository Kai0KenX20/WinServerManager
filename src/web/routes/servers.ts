import { Router, Request, Response } from 'express';
import { ServerManager } from '../../services/serverManager.js';
import { DatabaseService } from '../../services/database.js';
import { AuthService } from '../services/authService.js';
import { Server, ServerType, CreateServerRequest } from '../../types/index.js';

interface AuthRequest extends Request {
    serverManager: ServerManager;
    database: DatabaseService;
    authService: AuthService;
    session: any;
}

const router = Router();

// Middleware to check authentication
const requireAuth = (req: AuthRequest, res: Response, next: Function) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    const session = req.authService.getSession(req.session.userId);
    if (!session || !session.isAuthenticated) {
        return res.status(401).json({ error: 'Invalid session' });
    }
    
    req.authService.updateSessionActivity(req.session.userId);
    next();
};

// Middleware to check admin permission
const requireAdmin = (req: AuthRequest, res: Response, next: Function) => {
    if (!req.authService.hasPermission(req.session.userId, 'admin')) {
        return res.status(403).json({ error: 'Admin permission required' });
    }
    next();
};

// GET /api/servers - Get all servers
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
        const servers = await req.database.getServers();
        
        // Add runtime status to each server
        const serversWithStatus = await Promise.all(
            servers.map(async (server) => {
                const isRunning = await req.serverManager.isServerRunning(server.id);
                const metrics = isRunning ? await req.serverManager.getServerMetrics(server.id) : null;
                
                return {
                    ...server,
                    status: isRunning ? 'running' : 'stopped',
                    metrics: metrics
                };
            })
        );
        
        res.json(serversWithStatus);
    } catch (error) {
        console.error('Error fetching servers:', error);
        res.status(500).json({ error: 'Failed to fetch servers' });
    }
});

// POST /api/servers/:id/stop - Stop server
router.post('/:id/stop', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        
        const server = await req.database.getServerById(id);
        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }
        
        const isRunning = await req.serverManager.isServerRunning(id);
        if (!isRunning) {
            return res.status(400).json({ error: 'Server is not running' });
        }
        
        await req.serverManager.stopServer(id);
        
        res.json({ message: 'Server stop initiated' });
    } catch (error) {
        console.error('Error stopping server:', error);
        res.status(500).json({ 
            error: 'Failed to stop server',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// POST /api/servers/:id/start - Start server
router.post('/:id/start', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        
        const server = await req.database.getServerById(id);
        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }
        
        const isRunning = await req.serverManager.isServerRunning(id);
        if (isRunning) {
            return res.status(400).json({ error: 'Server is already running' });
        }
        
        await req.serverManager.startServer(id);
        
        res.json({ message: 'Server start initiated' });
    } catch (error) {
        console.error('Error starting server:', error);
        res.status(500).json({ 
            error: 'Failed to start server',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

export default router;