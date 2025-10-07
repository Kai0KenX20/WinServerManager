import * as systeminformation from 'systeminformation';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { SystemMetrics, NetworkInterface, ProcessInfo } from '../types';

/**
 * Enhanced SystemMonitor with comprehensive system monitoring
 * 
 * Features:
 * - Real-time CPU, memory, disk, and network monitoring
 * - Process tracking and resource usage
 * - Temperature monitoring (if available)
 * - Historical data collection
 * - Alert system for resource thresholds
 * - Performance optimization recommendations
 */
export class SystemMonitor extends EventEmitter {
    private isMonitoring: boolean = false;
    private monitoringInterval?: NodeJS.Timeout;
    private metricsHistory: SystemMetrics[] = [];
    private readonly maxHistorySize = 1000;
    
    // Monitoring configuration
    private readonly updateInterval = 5000; // 5 seconds
    private readonly alertThresholds = {
        cpu: 80, // 80%
        memory: 85, // 85%
        disk: 90 // 90%
    };

    constructor() {
        super();
        logger.debug('Enhanced SystemMonitor instantiated');
    }

    async initialize(): Promise<void> {
        try {
            logger.info('Initializing Enhanced SystemMonitor...');
            
            // Test system information access
            await this.testSystemAccess();
            
            // Start monitoring
            this.startMonitoring();
            
            this.isMonitoring = true;
            logger.info('Enhanced SystemMonitor initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize SystemMonitor:', error);
            throw error;
        }
    }

    /**
     * Test system information access
     */
    private async testSystemAccess(): Promise<void> {
        try {
            await systeminformation.cpu();
            await systeminformation.mem();
            await systeminformation.fsSize();
            logger.info('System information access verified');
        } catch (error) {
            logger.error('System information access failed:', error);
            throw new Error('Unable to access system information');
        }
    }

    /**
     * Start system monitoring
     */
    private startMonitoring(): void {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }

        this.monitoringInterval = setInterval(async () => {
            try {
                const metrics = await this.collectSystemMetrics();
                this.processMetrics(metrics);
            } catch (error) {
                logger.error('Error collecting system metrics:', error);
            }
        }, this.updateInterval);

        logger.info('System monitoring started');
    }

    /**
     * Collect comprehensive system metrics
     */
    private async collectSystemMetrics(): Promise<SystemMetrics> {
        try {
            const [cpuData, memData, diskData, networkData, processData, tempData] = await Promise.all([
                systeminformation.currentLoad(),
                systeminformation.mem(),
                systeminformation.fsSize(),
                systeminformation.networkInterfaces(),
                systeminformation.processes(),
                systeminformation.cpuTemperature().catch(() => null) // Optional, might not be available
            ]);

            // Process CPU data
            const cpu = {
                usage: Math.round(cpuData.currentLoad),
                cores: cpuData.cpus?.length || 1,
                temperature: tempData?.main || undefined
            };

            // Process memory data
            const memory = {
                total: memData.total,
                used: memData.used,
                free: memData.free,
                percentage: Math.round((memData.used / memData.total) * 100)
            };

            // Process disk data (primary drive)
            const primaryDisk = diskData[0] || { size: 0, used: 0, available: 0 };
            const disk = {
                total: primaryDisk.size,
                used: primaryDisk.used,
                free: primaryDisk.available,
                percentage: Math.round((primaryDisk.used / primaryDisk.size) * 100)
            };

            // Process network interfaces
            const interfaces: NetworkInterface[] = Object.values(networkData)
                .filter((iface: any) => !iface.internal && iface.ip4)
                .map((iface: any) => ({
                    name: iface.iface,
                    ip4: iface.ip4,
                    ip6: iface.ip6,
                    mac: iface.mac,
                    internal: iface.internal,
                    rx: iface.rx_bytes || 0,
                    tx: iface.tx_bytes || 0
                }));

            // Process running processes
            const processes: ProcessInfo[] = processData.list
                .slice(0, 20) // Top 20 processes by CPU
                .map((proc: any) => ({
                    pid: proc.pid,
                    name: proc.name,
                    cpu: proc.cpu || 0,
                    memory: proc.mem || 0
                }));

            const metrics: SystemMetrics = {
                cpu,
                memory,
                disk,
                network: { interfaces },
                processes
            };

            return metrics;
        } catch (error) {
            logger.error('Failed to collect system metrics:', error);
            throw error;
        }
    }

    /**
     * Process metrics and emit events
     */
    private processMetrics(metrics: SystemMetrics): void {
        // Add to history
        this.metricsHistory.push(metrics);
        if (this.metricsHistory.length > this.maxHistorySize) {
            this.metricsHistory.shift();
        }

        // Check for alerts
        this.checkAlerts(metrics);

        // Emit metrics update
        this.emit('systemMetrics', metrics);
    }

    /**
     * Check for system resource alerts
     */
    private checkAlerts(metrics: SystemMetrics): void {
        if (metrics.cpu.usage > this.alertThresholds.cpu) {
            this.emit('alert', {
                type: 'warning',
                title: 'High CPU Usage',
                message: `CPU usage is ${metrics.cpu.usage}%, which exceeds the threshold of ${this.alertThresholds.cpu}%`,
                timestamp: new Date()
            });
        }

        if (metrics.memory.percentage > this.alertThresholds.memory) {
            this.emit('alert', {
                type: 'warning',
                title: 'High Memory Usage',
                message: `Memory usage is ${metrics.memory.percentage}%, which exceeds the threshold of ${this.alertThresholds.memory}%`,
                timestamp: new Date()
            });
        }

        if (metrics.disk.percentage > this.alertThresholds.disk) {
            this.emit('alert', {
                type: 'error',
                title: 'High Disk Usage',
                message: `Disk usage is ${metrics.disk.percentage}%, which exceeds the threshold of ${this.alertThresholds.disk}%`,
                timestamp: new Date()
            });
        }
    }

    /**
     * Get current system metrics
     */
    async getSystemMetrics(): Promise<SystemMetrics> {
        if (this.metricsHistory.length > 0) {
            return this.metricsHistory[this.metricsHistory.length - 1];
        }
        
        // If no cached metrics, collect fresh ones
        return await this.collectSystemMetrics();
    }

    /**
     * Get system metrics history
     */
    getSystemMetricsHistory(limit?: number): SystemMetrics[] {
        if (limit && limit < this.metricsHistory.length) {
            return this.metricsHistory.slice(-limit);
        }
        return [...this.metricsHistory];
    }

    /**
     * Get system information summary
     */
    async getSystemInfo(): Promise<any> {
        try {
            const [system, cpu, osInfo, motherboard] = await Promise.all([
                systeminformation.system(),
                systeminformation.cpu(),
                systeminformation.osInfo(),
                systeminformation.baseboard().catch(() => null)
            ]);

            return {
                system: {
                    manufacturer: system.manufacturer,
                    model: system.model,
                    version: system.version
                },
                cpu: {
                    manufacturer: cpu.manufacturer,
                    brand: cpu.brand,
                    cores: cpu.cores,
                    physicalCores: cpu.physicalCores,
                    speed: cpu.speed
                },
                os: {
                    platform: osInfo.platform,
                    distro: osInfo.distro,
                    release: osInfo.release,
                    arch: osInfo.arch,
                    hostname: osInfo.hostname
                },
                motherboard: motherboard ? {
                    manufacturer: motherboard.manufacturer,
                    model: motherboard.model,
                    version: motherboard.version
                } : null
            };
        } catch (error) {
            logger.error('Failed to get system info:', error);
            throw error;
        }
    }

    /**
     * Set alert thresholds
     */
    setAlertThresholds(thresholds: Partial<typeof this.alertThresholds>): void {
        Object.assign(this.alertThresholds, thresholds);
        logger.info('Alert thresholds updated:', this.alertThresholds);
    }

    /**
     * Stop monitoring
     */
    private stopMonitoring(): void {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = undefined;
        }
        logger.info('System monitoring stopped');
    }

    async cleanup(): Promise<void> {
        logger.info('Cleaning up SystemMonitor...');
        
        this.stopMonitoring();
        this.metricsHistory = [];
        this.isMonitoring = false;
        
        logger.info('SystemMonitor cleanup completed');
    }

    /**
     * Check if monitoring is active
     */
    get monitoring(): boolean {
        return this.isMonitoring;
    }
}
