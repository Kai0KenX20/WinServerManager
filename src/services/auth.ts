import { logger } from '../utils/logger';

export class AuthService {
    private isInitialized: boolean = false;

    constructor() {
        logger.debug('AuthService instantiated');
    }

    async initialize(): Promise<void> {
        logger.info('AuthService initialized (stub)');
        this.isInitialized = true;
    }

    async cleanup(): Promise<void> {
        logger.info('AuthService cleanup (stub)');
        this.isInitialized = false;
    }
}