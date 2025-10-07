import express from 'express';
import { DatabaseService } from '../services/database';
import { ServerManager } from '../services/serverManager';
import { SystemMonitor } from '../services/systemMonitor';
import { logger } from '../utils/logger';
import { Server, ServerConfig } from '../types';

export function createAPIRoutes(
    database: DatabaseService,
    serverManager: ServerManager,
    systemMonitor: SystemMonitor
): express.Router {
    const router = express.Router();

    // Health check endpoint
    router.get('/health', (req, res) => {
        res.json({
            status: 'OK',
            timestamp: new Date().toISOString(),
            version: '0.1.0',
            uptime: process.uptime()
        });
    });

    // System metrics endpoint
    router.get('/system/metrics', async (req, res) => {
        try {
            const metrics = await systemMonitor.getSystemMetrics();
            res.json({
                success: true,
                data: metrics,
                timestamp: new Date()
            });
        } catch (error) {
            logger.error('Failed to get system metrics:', error);
            res.status(500).json({
                success: false,
                error: {
                    code: 'SYSTEM_METRICS_ERROR',
                    message: 'Failed to retrieve system metrics'
                }
            });
        }
    });

    // Server management endpoints
    router.get('/servers', async (req, res) => {
        try {
            const servers = serverManager.getServers();
            res.json({
                success: true,
                data: servers,
                timestamp: new Date()
            });
        } catch (error) {
            logger.error('Failed to get servers:', error);
            res.status(500).json({
                success: false,
                error: {
                    code: 'SERVER_LIST_ERROR',
                    message: 'Failed to retrieve servers'
                }
            });
        }
    });

    router.get('/servers/:id', async (req, res) => {
        try {
            const server = serverManager.getServer(req.params.id);
            if (!server) {
                return res.status(404).json({
                    success: false,
                    error: {
                        code: 'SERVER_NOT_FOUND',
                        message: 'Server not found'
                    }
                });
            }
            res.json({
                success: true,
                data: server,
                timestamp: new Date()
            });
        } catch (error) {
            logger.error('Failed to get server:', error);
            res.status(500).json({
                success: false,
                error: {
                    code: 'SERVER_GET_ERROR',
                    message: 'Failed to retrieve server'
                }
            });
        }
    });

    router.post('/servers', async (req, res) => {
        try {
            const { name, templateId, config } = req.body;
            
            if (!name || !templateId) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'INVALID_INPUT',
                        message: 'Server name and template ID are required'
                    }
                });
            }

            const server = await serverManager.createServer(name, templateId, config);
            
            res.status(201).json({
                success: true,
                data: server,
                timestamp: new Date()
            });
        } catch (error) {
            logger.error('Failed to create server:', error);
            res.status(500).json({
                success: false,
                error: {
                    code: 'SERVER_CREATE_ERROR',
                    message: error instanceof Error ? error.message : 'Failed to create server'
                }
            });
        }
    });

    router.post('/servers/:id/start', async (req, res) => {
        try {
            const success = await serverManager.startServer(req.params.id);
            
            if (success) {
                res.json({
                    success: true,
                    message: 'Server start initiated',
                    timestamp: new Date()
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: {
                        code: 'SERVER_START_FAILED',
                        message: 'Failed to start server'
                    }
                });
            }
        } catch (error) {
            logger.error('Failed to start server:', error);
            res.status(500).json({
                success: false,
                error: {
                    code: 'SERVER_START_ERROR',
                    message: error instanceof Error ? error.message : 'Failed to start server'
                }
            });
        }
    });

    router.post('/servers/:id/stop', async (req, res) => {
        try {
            const force = req.body.force === true;
            const success = await serverManager.stopServer(req.params.id, force);
            
            if (success) {
                res.json({
                    success: true,
                    message: 'Server stop initiated',
                    timestamp: new Date()
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: {
                        code: 'SERVER_STOP_FAILED',
                        message: 'Failed to stop server'
                    }
                });
            }
        } catch (error) {
            logger.error('Failed to stop server:', error);
            res.status(500).json({
                success: false,
                error: {
                    code: 'SERVER_STOP_ERROR',
                    message: error instanceof Error ? error.message : 'Failed to stop server'
                }
            });
        }
    });

    router.delete('/servers/:id', async (req, res) => {
        try {
            const deleteFiles = req.query.deleteFiles === 'true';
            await serverManager.deleteServer(req.params.id, deleteFiles);
            
            res.json({
                success: true,
                message: 'Server deleted successfully',
                timestamp: new Date()
            });
        } catch (error) {
            logger.error('Failed to delete server:', error);
            res.status(500).json({
                success: false,
                error: {
                    code: 'SERVER_DELETE_ERROR',
                    message: error instanceof Error ? error.message : 'Failed to delete server'
                }
            });
        }
    });

    // Server templates endpoint
    router.get('/templates', (req, res) => {
        try {
            const templates = serverManager.getServerTemplates();
            res.json({
                success: true,
                data: templates,
                timestamp: new Date()
            });
        } catch (error) {
            logger.error('Failed to get templates:', error);
            res.status(500).json({
                success: false,
                error: {
                    code: 'TEMPLATE_LIST_ERROR',
                    message: 'Failed to retrieve templates'
                }
            });
        }
    });

    // Server logs endpoint
    router.get('/servers/:id/logs', async (req, res) => {
        try {
            const limit = parseInt(req.query.limit as string) || 100;
            const logs = await database.getServerLogs(req.params.id, limit);
            
            res.json({
                success: true,
                data: logs,
                timestamp: new Date()
            });
        } catch (error) {
            logger.error('Failed to get server logs:', error);
            res.status(500).json({
                success: false,
                error: {
                    code: 'SERVER_LOGS_ERROR',
                    message: 'Failed to retrieve server logs'
                }
            });
        }
    });

    // Backup endpoints
    router.post('/servers/:id/backup', async (req, res) => {
        try {
            const { name } = req.body;
            const backup = await serverManager.createBackup(req.params.id, name);
            
            res.status(201).json({
                success: true,
                data: backup,
                timestamp: new Date()
            });
        } catch (error) {
            logger.error('Failed to create backup:', error);
            res.status(500).json({
                success: false,
                error: {
                    code: 'BACKUP_CREATE_ERROR',
                    message: error instanceof Error ? error.message : 'Failed to create backup'
                }
            });
        }
    });

    // Error handling middleware
    router.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
        logger.error('API Error:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Internal server error'
            },
            timestamp: new Date()
        });
    });

    return router;
}