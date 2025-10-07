import { exec } from 'child_process';
import { promisify } from 'util';
import { SystemMetrics } from '../../types/index.js';

const execAsync = promisify(exec);

export class SystemMonitor {
    private isMonitoring: boolean = false;
    private intervalId: NodeJS.Timeout | null = null;
    private callbacks: ((metrics: SystemMetrics) => void)[] = [];

    public startMonitoring(callback: (metrics: SystemMetrics) => void): void {
        this.callbacks.push(callback);
        
        if (this.isMonitoring) return;
        
        this.isMonitoring = true;
        this.intervalId = setInterval(async () => {
            try {
                const metrics = await this.collectMetrics();
                this.callbacks.forEach(cb => cb(metrics));
            } catch (error) {
                console.error('Failed to collect system metrics:', error);
            }
        }, 5000); // Collect every 5 seconds
    }

    public stopMonitoring(): void {
        this.isMonitoring = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.callbacks = [];
    }

    private async collectMetrics(): Promise<SystemMetrics> {
        const [cpuUsage, memoryInfo, diskInfo] = await Promise.all([
            this.getCpuUsage(),
            this.getMemoryInfo(),
            this.getDiskInfo()
        ]);

        return {
            timestamp: new Date(),
            cpu: cpuUsage,
            memory: memoryInfo,
            disk: diskInfo,
            network: await this.getNetworkInfo(),
            uptime: process.uptime()
        };
    }

    private async getCpuUsage(): Promise<number> {
        try {
            // Use PowerShell to get CPU usage
            const { stdout } = await execAsync(
                'powershell -Command "Get-Counter \\"\\\\Processor(_Total)\\\\% Processor Time\\" -SampleInterval 1 -MaxSamples 1 | Select-Object -ExpandProperty CounterSamples | Select-Object -ExpandProperty CookedValue"'
            );
            const usage = parseFloat(stdout.trim());
            return Math.min(100, Math.max(0, usage));
        } catch (error) {
            console.error('Failed to get CPU usage:', error);
            return 0;
        }
    }

    private async getMemoryInfo(): Promise<{ used: number; total: number; available: number }> {
        try {
            // Get total physical memory
            const { stdout: totalMemoryOutput } = await execAsync(
                'powershell -Command "(Get-CimInstance Win32_PhysicalMemory | Measure-Object -Property capacity -Sum).sum"'
            );
            const totalMemory = parseInt(totalMemoryOutput.trim());

            // Get available memory
            const { stdout: availableMemoryOutput } = await execAsync(
                'powershell -Command "(Get-CimInstance Win32_OperatingSystem).TotalVisibleMemorySize * 1024"'
            );
            const availableMemory = parseInt(availableMemoryOutput.trim());

            // Get free memory
            const { stdout: freeMemoryOutput } = await execAsync(
                'powershell -Command "(Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory * 1024"'
            );
            const freeMemory = parseInt(freeMemoryOutput.trim());

            const usedMemory = totalMemory - freeMemory;

            return {
                used: usedMemory,
                total: totalMemory,
                available: freeMemory
            };
        } catch (error) {
            console.error('Failed to get memory info:', error);
            return { used: 0, total: 0, available: 0 };
        }
    }

    private async getDiskInfo(): Promise<{ used: number; total: number; available: number }[]> {
        try {
            const { stdout } = await execAsync(
                'powershell -Command "Get-CimInstance -Class Win32_LogicalDisk | Select-Object DeviceID, Size, FreeSpace | ConvertTo-Json"'
            );
            
            const disks = JSON.parse(stdout);
            const diskArray = Array.isArray(disks) ? disks : [disks];
            
            return diskArray
                .filter((disk: any) => disk.Size) // Filter out null sizes
                .map((disk: any) => ({
                    deviceId: disk.DeviceID,
                    total: parseInt(disk.Size),
                    available: parseInt(disk.FreeSpace),
                    used: parseInt(disk.Size) - parseInt(disk.FreeSpace)
                }));
        } catch (error) {
            console.error('Failed to get disk info:', error);
            return [];
        }
    }

    private async getNetworkInfo(): Promise<{ bytesReceived: number; bytesSent: number }> {
        try {
            // Get network statistics
            const { stdout } = await execAsync(
                'powershell -Command "Get-Counter \\"\\\\Network Interface(*)\\\\Bytes Received/sec\\", \\"\\\\Network Interface(*)\\\\Bytes Sent/sec\\" | Select-Object -ExpandProperty CounterSamples | Where-Object InstanceName -NotLike \\"*Loopback*\\" | Where-Object InstanceName -NotLike \\"*isatap*\\" | Measure-Object CookedValue -Sum | Select-Object Sum"'
            );
            
            // This is a simplified version - in a real implementation you'd want to track deltas
            return {
                bytesReceived: 0, // Would need to implement proper network monitoring
                bytesSent: 0
            };
        } catch (error) {
            console.error('Failed to get network info:', error);
            return { bytesReceived: 0, bytesSent: 0 };
        }
    }

    public async getProcessList(): Promise<Array<{ pid: number; name: string; cpu: number; memory: number }>> {
        try {
            const { stdout } = await execAsync(
                'powershell -Command "Get-Process | Select-Object Id, ProcessName, CPU, WorkingSet | ConvertTo-Json"'
            );
            
            const processes = JSON.parse(stdout);
            const processArray = Array.isArray(processes) ? processes : [processes];
            
            return processArray.map((proc: any) => ({
                pid: proc.Id,
                name: proc.ProcessName,
                cpu: parseFloat(proc.CPU) || 0,
                memory: parseInt(proc.WorkingSet) || 0
            }));
        } catch (error) {
            console.error('Failed to get process list:', error);
            return [];
        }
    }
}