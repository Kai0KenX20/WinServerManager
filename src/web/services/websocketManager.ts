import { Server as SocketIOServer, Socket } from 'socket.io';
import { SystemMetrics } from '../../types/index.js';

interface ClientInfo {
    id: string;
    socket: Socket;
    subscriptions: Set<string>;
    joinedAt: Date;
}

export class WebSocketManager {
    private io: SocketIOServer;
    private clients: Map<string, ClientInfo> = new Map();

    constructor(io: SocketIOServer) {
        this.io = io;
    }

    public handleConnection(socket: Socket): void {
        const clientInfo: ClientInfo = {
            id: socket.id,
            socket: socket,
            subscriptions: new Set(),
            joinedAt: new Date()
        };

        this.clients.set(socket.id, clientInfo);

        // Handle subscription events
        socket.on('subscribe', (topic: string) => {
            this.subscribe(socket.id, topic);
        });

        socket.on('unsubscribe', (topic: string) => {
            this.unsubscribe(socket.id, topic);
        });

        // Handle server control events
        socket.on('start-server', (serverId: string) => {
            this.handleServerControl(socket, 'start', serverId);
        });

        socket.on('stop-server', (serverId: string) => {
            this.handleServerControl(socket, 'stop', serverId);
        });

        socket.on('restart-server', (serverId: string) => {
            this.handleServerControl(socket, 'restart', serverId);
        });

        // Send initial data
        this.sendWelcomeMessage(socket);
    }

    public handleDisconnection(socket: Socket): void {
        this.clients.delete(socket.id);
    }

    private subscribe(clientId: string, topic: string): void {
        const client = this.clients.get(clientId);
        if (client) {
            client.subscriptions.add(topic);
            client.socket.join(topic);
            console.log(`Client ${clientId} subscribed to ${topic}`);
        }
    }

    private unsubscribe(clientId: string, topic: string): void {
        const client = this.clients.get(clientId);
        if (client) {
            client.subscriptions.delete(topic);
            client.socket.leave(topic);
            console.log(`Client ${clientId} unsubscribed from ${topic}`);
        }
    }

    private async handleServerControl(socket: Socket, action: string, serverId: string): Promise<void> {
        try {
            // Emit to all clients that server control action is in progress
            this.io.emit('server-control-progress', {
                serverId,
                action,
                status: 'in-progress',
                timestamp: new Date()
            });

            // The actual server control will be handled by the main application
            socket.emit('server-control-request', { action, serverId });

        } catch (error) {
            socket.emit('server-control-error', {
                serverId,
                action,
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date()
            });
        }
    }

    private sendWelcomeMessage(socket: Socket): void {
        socket.emit('welcome', {
            message: 'Connected to WinServerManager',
            clientId: socket.id,
            timestamp: new Date(),
            availableSubscriptions: [
                'system-metrics',
                'server-status',
                'server-logs',
                'alerts',
                'backups'
            ]
        });
    }

    // Public methods for broadcasting data

    public broadcastSystemMetrics(metrics: SystemMetrics): void {
        this.io.to('system-metrics').emit('system-metrics', {
            timestamp: new Date(),
            data: metrics
        });
    }

    public broadcastServerStatuses(statuses: Array<any>): void {
        this.io.to('server-status').emit('server-status', {
            timestamp: new Date(),
            servers: statuses
        });
    }

    public broadcastServerLogs(serverId: string, logs: Array<any>): void {
        this.io.to('server-logs').emit('server-logs', {
            serverId,
            timestamp: new Date(),
            logs
        });
        
        // Also send to specific server log subscribers
        this.io.to(`server-logs-${serverId}`).emit('server-logs', {
            serverId,
            timestamp: new Date(),
            logs
        });
    }

    public broadcastAlert(alert: any): void {
        this.io.to('alerts').emit('alert', {
            timestamp: new Date(),
            alert
        });

        // Also broadcast to all connected clients for important alerts
        if (alert.severity === 'critical' || alert.severity === 'high') {
            this.io.emit('critical-alert', {
                timestamp: new Date(),
                alert
            });
        }
    }

    public broadcastBackupStatus(backupInfo: any): void {
        this.io.to('backups').emit('backup-status', {
            timestamp: new Date(),
            backup: backupInfo
        });
    }

    public broadcastServerCreated(server: any): void {
        this.io.emit('server-created', {
            timestamp: new Date(),
            server
        });
    }

    public broadcastServerDeleted(serverId: string): void {
        this.io.emit('server-deleted', {
            timestamp: new Date(),
            serverId
        });
    }

    public broadcastServerUpdated(server: any): void {
        this.io.emit('server-updated', {
            timestamp: new Date(),
            server
        });
    }

    // Utility methods

    public getConnectedClients(): Array<{ id: string; joinedAt: Date; subscriptions: string[] }> {
        return Array.from(this.clients.values()).map(client => ({
            id: client.id,
            joinedAt: client.joinedAt,
            subscriptions: Array.from(client.subscriptions)
        }));
    }

    public getClientCount(): number {
        return this.clients.size;
    }

    public isClientConnected(clientId: string): boolean {
        return this.clients.has(clientId);
    }

    public disconnectClient(clientId: string, reason?: string): void {
        const client = this.clients.get(clientId);
        if (client) {
            client.socket.disconnect(true);
            this.clients.delete(clientId);
            console.log(`Disconnected client ${clientId}${reason ? `: ${reason}` : ''}`);
        }
    }

    public sendToClient(clientId: string, event: string, data: any): boolean {
        const client = this.clients.get(clientId);
        if (client) {
            client.socket.emit(event, data);
            return true;
        }
        return false;
    }

    public broadcastToAll(event: string, data: any): void {
        this.io.emit(event, data);
    }

    public getSubscribersCount(topic: string): number {
        return this.io.sockets.adapter.rooms.get(topic)?.size || 0;
    }
}