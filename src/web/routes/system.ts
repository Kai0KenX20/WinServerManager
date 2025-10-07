import { Router, Request, Response } from 'express';
import { DatabaseService } from '../../services/database.js';
import { AuthService } from '../services/authService.js';

interface AuthRequest extends Request {
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

// GET /api/system/info - Get system information
router.get('/info', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
        const systemInfo = {
            platform: process.platform,
            architecture: process.arch,
            nodeVersion: process.version,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            timestamp: new Date()
        };
        
        res.json(systemInfo);
    } catch (error) {
        console.error('Error fetching system info:', error);
        res.status(500).json({ error: 'Failed to fetch system info' });
    }
});

// GET /api/system/stats - Get system statistics
router.get('/stats', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
        const [servers, logs, backups, alerts] = await Promise.all([
            req.database.getServers(),
            req.database.getLogs(100),
            req.database.getBackups(),
            req.database.getAlerts(50)
        ]);

        const stats = {
            totalServers: servers.length,
            runningServers: 0, // Would need to check each server's status
            totalBackups: backups.length,
            recentAlerts: alerts.filter(alert => {
                const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
                return new Date(alert.timestamp) > hourAgo;
            }).length,
            totalLogs: logs.length
        };

        res.json(stats);
    } catch (error) {
        console.error('Error fetching system stats:', error);
        res.status(500).json({ error: 'Failed to fetch system stats' });
    }
});

// GET /api/system/logs - Get system logs
router.get('/logs', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
        const { limit = 100, offset = 0, level } = req.query;
        
        let logs = await req.database.getLogs(parseInt(limit as string), parseInt(offset as string));
        
        // Filter by log level if specified
        if (level) {
            logs = logs.filter(log => log.level === level);
        }
        
        res.json({ logs });
    } catch (error) {
        console.error('Error fetching logs:', error);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

// GET /api/system/alerts - Get system alerts
router.get('/alerts', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
        const { limit = 50, severity } = req.query;
        
        let alerts = await req.database.getAlerts(parseInt(limit as string));
        
        // Filter by severity if specified
        if (severity) {
            alerts = alerts.filter(alert => alert.severity === severity);
        }
        
        res.json({ alerts });
    } catch (error) {
        console.error('Error fetching alerts:', error);
        res.status(500).json({ error: 'Failed to fetch alerts' });
    }
});

// POST /api/system/alerts/:id/acknowledge - Acknowledge alert
router.post('/alerts/:id/acknowledge', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.session.userId;
        
        const alert = await req.database.getAlertById(id);
        if (!alert) {
            return res.status(404).json({ error: 'Alert not found' });
        }
        
        alert.isAcknowledged = true;
        alert.acknowledgedBy = userId;
        alert.acknowledgedAt = new Date();
        
        await req.database.saveAlert(alert);
        
        res.json({ message: 'Alert acknowledged successfully' });
    } catch (error) {
        console.error('Error acknowledging alert:', error);
        res.status(500).json({ error: 'Failed to acknowledge alert' });
    }
});

// DELETE /api/system/logs - Clear old logs
router.delete('/logs', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
        // Check admin permission for this operation
        if (!req.authService.hasPermission(req.session.userId, 'admin')) {
            return res.status(403).json({ error: 'Admin permission required' });
        }
        
        const { olderThan } = req.query;
        
        if (!olderThan) {
            return res.status(400).json({ error: 'olderThan parameter is required (in days)' });
        }
        
        const days = parseInt(olderThan as string);
        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        
        const deletedCount = await req.database.deleteLogsOlderThan(cutoffDate);
        
        res.json({ 
            message: `Deleted ${deletedCount} log entries older than ${days} days` 
        });
    } catch (error) {
        console.error('Error clearing logs:', error);
        res.status(500).json({ error: 'Failed to clear logs' });
    }
});

// GET /api/system/backup-summary - Get backup summary
router.get('/backup-summary', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
        const backups = await req.database.getBackups();
        
        const summary = {
            totalBackups: backups.length,
            totalSize: backups.reduce((sum, backup) => sum + (backup.size || 0), 0),
            oldestBackup: backups.length > 0 ? Math.min(...backups.map(b => new Date(b.createdAt).getTime())) : null,
            newestBackup: backups.length > 0 ? Math.max(...backups.map(b => new Date(b.createdAt).getTime())) : null,
            backupsByServer: backups.reduce((acc, backup) => {
                acc[backup.serverId] = (acc[backup.serverId] || 0) + 1;
                return acc;
            }, {} as Record<string, number>)
        };
        
        res.json(summary);
    } catch (error) {
        console.error('Error fetching backup summary:', error);
        res.status(500).json({ error: 'Failed to fetch backup summary' });
    }
});

// POST /api/system/cleanup - Perform system cleanup
router.post('/cleanup', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
        // Check admin permission
        if (!req.authService.hasPermission(req.session.userId, 'admin')) {
            return res.status(403).json({ error: 'Admin permission required' });
        }
        
        const { 
            cleanLogs = false, 
            logsDays = 30, 
            cleanBackups = false, 
            backupsDays = 90 
        } = req.body;
        
        const results: any = {
            logsDeleted: 0,
            backupsDeleted: 0
        };
        
        if (cleanLogs) {
            const cutoffDate = new Date(Date.now() - logsDays * 24 * 60 * 60 * 1000);
            results.logsDeleted = await req.database.deleteLogsOlderThan(cutoffDate);
        }
        
        if (cleanBackups) {
            const cutoffDate = new Date(Date.now() - backupsDays * 24 * 60 * 60 * 1000);
            results.backupsDeleted = await req.database.deleteBackupsOlderThan(cutoffDate);
        }
        
        // Clean up expired sessions
        req.authService.cleanupExpiredSessions();
        
        res.json({
            message: 'System cleanup completed',
            results
        });
    } catch (error) {
        console.error('Error during system cleanup:', error);
        res.status(500).json({ error: 'Failed to perform system cleanup' });
    }
});

export default router;