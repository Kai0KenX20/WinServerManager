import { DatabaseService } from './services/database.js';
import { ServerManager } from './services/serverManager.js';
import { WebServer } from './web/server.js';

async function main() {
    console.log('🚀 Starting WinServerManager...');
    
    try {
        // Initialize database
        console.log('📦 Initializing database...');
        const database = new DatabaseService();
        await database.initialize();
        
        // Initialize server manager
        console.log('🎮 Initializing server manager...');
        const serverManager = new ServerManager(database);
        
        // Initialize web server
        console.log('🌐 Starting web server...');
        const webServer = new WebServer(serverManager, database, 8080);
        await webServer.start();
        
        console.log('');
        console.log('✅ WinServerManager started successfully!');
        console.log('');
        console.log('🔗 Web Interface: http://localhost:8080');
        console.log('👤 Default Admin: admin / WinAdmin@2024');
        console.log('');
        console.log('⚠️  IMPORTANT: Change the default password after first login!');
        console.log('');
        
        // Keep the application running
        process.on('SIGINT', async () => {
            console.log('\n🛑 Shutting down WinServerManager...');
            try {
                await webServer.stop();
                await database.close();
                console.log('✅ Shutdown completed successfully');
                process.exit(0);
            } catch (error) {
                console.error('❌ Error during shutdown:', error);
                process.exit(1);
            }
        });
        
        process.on('SIGTERM', async () => {
            console.log('\n🛑 Received SIGTERM, shutting down...');
            try {
                await webServer.stop();
                await database.close();
                process.exit(0);
            } catch (error) {
                console.error('❌ Error during shutdown:', error);
                process.exit(1);
            }
        });
        
    } catch (error) {
        console.error('❌ Failed to start WinServerManager:', error);
        process.exit(1);
    }
}

main();

export {};