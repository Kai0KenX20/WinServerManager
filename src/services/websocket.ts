import { WebSocketServer } from 'ws';
import { logger } from '../utils/logger';

export class WebSocketHandler {
    private wsServer: WebSocketServer;
    private isInitialized: boolean = false;

    constructor(wsServer: WebSocketServer) {
        this.wsServer = wsServer;
        logger.debug('WebSocketHandler instantiated');
    }

    initialize(): void {
        logger.info('WebSocketHandler initialized (stub)');
        this.isInitialized = true;
    }
}