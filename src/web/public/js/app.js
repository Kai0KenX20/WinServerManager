// WinServerManager Frontend Application
class WinServerManager {
    constructor() {
        this.socket = null;
        this.currentUser = null;
        this.isAuthenticated = false;
        this.currentView = 'dashboard';
        
        this.init();
    }

    init() {
        this.checkAuthentication();
        this.setupEventListeners();
        this.setupNavigation();
    }

    async checkAuthentication() {
        try {
            const response = await fetch('/api/auth/me');
            if (response.ok) {
                const data = await response.json();
                this.currentUser = data.user;
                this.isAuthenticated = true;
                this.showApp();
                this.connectWebSocket();
            } else {
                this.showLogin();
            }
        } catch (error) {
            console.error('Authentication check failed:', error);
            this.showLogin();
        }
    }

    showLogin() {
        document.getElementById('loginModal').classList.add('show');
        document.getElementById('app').style.display = 'none';
    }

    showApp() {
        document.getElementById('loginModal').classList.remove('show');
        document.getElementById('app').style.display = 'block';
        
        if (this.currentUser) {
            document.getElementById('currentUser').textContent = this.currentUser.username;
            
            // Hide admin-only elements for non-admin users
            if (this.currentUser.role !== 'admin') {
                document.querySelectorAll('.admin-only').forEach(el => {
                    el.style.display = 'none';
                });
            }
        }
        
        this.loadDashboard();
    }

    connectWebSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.updateConnectionStatus(true);
            
            // Subscribe to real-time updates
            this.socket.emit('subscribe', 'system-metrics');
            this.socket.emit('subscribe', 'server-status');
            this.socket.emit('subscribe', 'alerts');
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.updateConnectionStatus(false);
        });

        this.socket.on('system-metrics', (data) => {
            this.updateSystemMetrics(data.data);
        });

        this.socket.on('server-status', (data) => {
            this.updateServerStatuses(data.servers);
        });

        this.socket.on('alert', (data) => {
            this.showNotification(data.alert);
            this.loadAlerts();
        });

        this.socket.on('critical-alert', (data) => {
            this.showCriticalAlert(data.alert);
        });

        this.socket.on('welcome', (data) => {
            console.log('Welcome message:', data.message);
        });
    }

    updateConnectionStatus(isConnected) {
        const statusEl = document.getElementById('connectionStatus');
        if (isConnected) {
            statusEl.className = 'status-indicator online';
            statusEl.innerHTML = '<i class="fas fa-circle"></i> Connected';
        } else {
            statusEl.className = 'status-indicator offline';
            statusEl.innerHTML = '<i class="fas fa-circle"></i> Disconnected';
        }
    }

    setupEventListeners() {
        // Login form
        document.getElementById('loginForm').addEventListener('submit', this.handleLogin.bind(this));
        
        // Logout button
        document.getElementById('logoutBtn').addEventListener('click', this.handleLogout.bind(this));
        
        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', this.refreshDashboard.bind(this));
        
        // Create server button
        document.getElementById('createServerBtn').addEventListener('click', this.showCreateServerModal.bind(this));
        
        // Create server form
        document.getElementById('createServerForm').addEventListener('submit', this.handleCreateServer.bind(this));
        
        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.closeModal(e.target.closest('.modal'));
            });
        });

        // Click outside modal to close
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal);
                }
            });
        });
    }

    setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const view = e.currentTarget.getAttribute('href').substring(1);
                this.navigateTo(view);
            });
        });
    }

    navigateTo(view) {
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[href="#${view}"]`).classList.add('active');

        // Update views
        document.querySelectorAll('.view').forEach(viewEl => {
            viewEl.classList.remove('active');
        });
        
        const viewEl = document.getElementById(`${view}View`);
        if (viewEl) {
            viewEl.classList.add('active');
            this.currentView = view;
            
            // Load view-specific data
            switch (view) {
                case 'dashboard':
                    this.loadDashboard();
                    break;
                case 'servers':
                    this.loadServers();
                    break;
                case 'system':
                    this.loadSystemView();
                    break;
                case 'logs':
                    this.loadLogs();
                    break;
                case 'users':
                    this.loadUsers();
                    break;
            }
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const loginData = {
            username: formData.get('username'),
            password: formData.get('password')
        };

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(loginData)
            });

            const data = await response.json();

            if (response.ok) {
                this.currentUser = data.user;
                this.isAuthenticated = true;
                this.showApp();
                this.connectWebSocket();
            } else {
                this.showError('loginError', data.error);
            }
        } catch (error) {
            this.showError('loginError', 'Login failed. Please try again.');
        }
    }

    async handleLogout() {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            this.isAuthenticated = false;
            this.currentUser = null;
            
            if (this.socket) {
                this.socket.disconnect();
            }
            
            this.showLogin();
        } catch (error) {
            console.error('Logout failed:', error);
        }
    }

    async loadDashboard() {
        try {
            // Load system stats
            const [statsResponse, serversResponse, alertsResponse] = await Promise.all([
                fetch('/api/system/stats'),
                fetch('/api/servers'),
                fetch('/api/system/alerts?limit=5')
            ]);

            if (statsResponse.ok) {
                const stats = await statsResponse.json();
                this.updateStats(stats);
            }

            if (serversResponse.ok) {
                const servers = await serversResponse.json();
                this.updateServersList(servers);
            }

            if (alertsResponse.ok) {
                const alerts = await alertsResponse.json();
                this.updateAlertsList(alerts.alerts);
            }

        } catch (error) {
            console.error('Failed to load dashboard:', error);
        }
    }

    updateStats(stats) {
        document.getElementById('totalServers').textContent = stats.totalServers || 0;
        document.getElementById('runningServers').textContent = stats.runningServers || 0;
        document.getElementById('totalBackups').textContent = stats.totalBackups || 0;
        document.getElementById('recentAlerts').textContent = stats.recentAlerts || 0;
    }

    updateSystemMetrics(metrics) {
        // CPU Usage
        const cpuPercent = Math.round(metrics.cpu || 0);
        document.getElementById('cpuProgress').style.width = `${cpuPercent}%`;
        document.getElementById('cpuText').textContent = `${cpuPercent}%`;

        // Memory Usage
        if (metrics.memory) {
            const memUsed = (metrics.memory.used / (1024 * 1024 * 1024)).toFixed(1);
            const memTotal = (metrics.memory.total / (1024 * 1024 * 1024)).toFixed(1);
            const memPercent = Math.round((metrics.memory.used / metrics.memory.total) * 100);
            
            document.getElementById('memoryProgress').style.width = `${memPercent}%`;
            document.getElementById('memoryText').textContent = `${memUsed} GB / ${memTotal} GB`;
        }

        // Disk Usage (show first disk)
        if (metrics.disk && metrics.disk.length > 0) {
            const disk = metrics.disk[0];
            const diskUsed = (disk.used / (1024 * 1024 * 1024)).toFixed(1);
            const diskTotal = (disk.total / (1024 * 1024 * 1024)).toFixed(1);
            const diskPercent = Math.round((disk.used / disk.total) * 100);
            
            document.getElementById('diskProgress').style.width = `${diskPercent}%`;
            document.getElementById('diskText').textContent = `${diskUsed} GB / ${diskTotal} GB`;
        }

        // Uptime
        if (metrics.uptime) {
            const days = Math.floor(metrics.uptime / (24 * 3600));
            const hours = Math.floor((metrics.uptime % (24 * 3600)) / 3600);
            document.getElementById('uptimeText').textContent = `${days}d ${hours}h`;
        }
    }

    updateServersList(servers) {
        const container = document.getElementById('serversList');
        if (!container) return;

        if (servers.length === 0) {
            container.innerHTML = '<p class="text-gray-400">No servers configured</p>';
            return;
        }

        container.innerHTML = servers.slice(0, 6).map(server => `
            <div class="server-card">
                <div class="server-header">
                    <div class="server-name">${this.escapeHtml(server.name)}</div>
                    <div class="server-status ${server.status || 'stopped'}">${server.status || 'Stopped'}</div>
                </div>
                <div class="server-type">${this.escapeHtml(server.type || 'Unknown')}</div>
                ${server.metrics ? `
                    <div class="server-metrics">
                        <div class="metric">
                            <div class="metric-value">${server.metrics.cpu || 0}%</div>
                            <div class="metric-label">CPU</div>
                        </div>
                        <div class="metric">
                            <div class="metric-value">${Math.round((server.metrics.memory || 0) / 1024 / 1024)}MB</div>
                            <div class="metric-label">Memory</div>
                        </div>
                        <div class="metric">
                            <div class="metric-value">${server.metrics.players || 0}</div>
                            <div class="metric-label">Players</div>
                        </div>
                    </div>
                ` : ''}
                <div class="server-actions">
                    ${server.status === 'running' ? 
                        `<button class="btn btn-secondary btn-small" onclick="app.stopServer('${server.id}')">
                            <i class="fas fa-stop"></i> Stop
                        </button>` :
                        `<button class="btn btn-primary btn-small" onclick="app.startServer('${server.id}')">
                            <i class="fas fa-play"></i> Start
                        </button>`
                    }
                    <button class="btn btn-secondary btn-small" onclick="app.restartServer('${server.id}')">
                        <i class="fas fa-redo"></i> Restart
                    </button>
                </div>
            </div>
        `).join('');
    }

    updateAlertsList(alerts) {
        const container = document.getElementById('alertsList');
        if (!container) return;

        if (alerts.length === 0) {
            container.innerHTML = '<p class="text-gray-400">No recent alerts</p>';
            return;
        }

        container.innerHTML = alerts.map(alert => `
            <div class="alert-item">
                <div class="alert-icon ${alert.severity}">
                    <i class="fas ${this.getAlertIcon(alert.severity)}"></i>
                </div>
                <div class="alert-content">
                    <div class="alert-message">${this.escapeHtml(alert.message)}</div>
                    <div class="alert-time">${this.formatTime(alert.timestamp)}</div>
                </div>
            </div>
        `).join('');
    }

    showCreateServerModal() {
        document.getElementById('createServerModal').classList.add('show');
    }

    async handleCreateServer(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const serverData = {
            name: formData.get('name'),
            type: formData.get('type'),
            installPath: formData.get('installPath'),
            port: parseInt(formData.get('port')) || 25565
        };

        try {
            const response = await fetch('/api/servers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(serverData)
            });

            if (response.ok) {
                this.closeModal(document.getElementById('createServerModal'));
                this.showSuccess('Server creation initiated!');
                this.refreshDashboard();
            } else {
                const error = await response.json();
                this.showError('createServerError', error.error);
            }
        } catch (error) {
            this.showError('createServerError', 'Failed to create server');
        }
    }

    async startServer(serverId) {
        try {
            const response = await fetch(`/api/servers/${serverId}/start`, {
                method: 'POST'
            });

            if (response.ok) {
                this.showSuccess('Server start initiated');
            } else {
                const error = await response.json();
                this.showError('serverError', error.error);
            }
        } catch (error) {
            this.showError('serverError', 'Failed to start server');
        }
    }

    async stopServer(serverId) {
        try {
            const response = await fetch(`/api/servers/${serverId}/stop`, {
                method: 'POST'
            });

            if (response.ok) {
                this.showSuccess('Server stop initiated');
            } else {
                const error = await response.json();
                this.showError('serverError', error.error);
            }
        } catch (error) {
            this.showError('serverError', 'Failed to stop server');
        }
    }

    async restartServer(serverId) {
        try {
            const response = await fetch(`/api/servers/${serverId}/restart`, {
                method: 'POST'
            });

            if (response.ok) {
                this.showSuccess('Server restart initiated');
            } else {
                const error = await response.json();
                this.showError('serverError', error.error);
            }
        } catch (error) {
            this.showError('serverError', 'Failed to restart server');
        }
    }

    refreshDashboard() {
        if (this.currentView === 'dashboard') {
            this.loadDashboard();
        }
    }

    closeModal(modal) {
        if (typeof modal === 'string') {
            modal = document.getElementById(modal);
        }
        if (modal) {
            modal.classList.remove('show');
        }
    }

    showError(elementId, message) {
        const errorEl = document.getElementById(elementId);
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
            setTimeout(() => {
                errorEl.style.display = 'none';
            }, 5000);
        }
    }

    showSuccess(message) {
        // Create temporary success notification
        const notification = document.createElement('div');
        notification.className = 'success-message';
        notification.textContent = message;
        notification.style.position = 'fixed';
        notification.style.top = '80px';
        notification.style.right = '20px';
        notification.style.zIndex = '3000';
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    showNotification(alert) {
        // Show toast notification for new alerts
        const notification = document.createElement('div');
        notification.className = `alert-item ${alert.severity}`;
        notification.innerHTML = `
            <div class="alert-icon ${alert.severity}">
                <i class="fas ${this.getAlertIcon(alert.severity)}"></i>
            </div>
            <div class="alert-content">
                <div class="alert-message">${this.escapeHtml(alert.message)}</div>
                <div class="alert-time">Just now</div>
            </div>
        `;
        notification.style.position = 'fixed';
        notification.style.top = '80px';
        notification.style.right = '20px';
        notification.style.zIndex = '3000';
        notification.style.minWidth = '300px';
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }

    getAlertIcon(severity) {
        switch (severity) {
            case 'error':
            case 'critical':
                return 'fa-exclamation-circle';
            case 'warning':
                return 'fa-exclamation-triangle';
            case 'info':
                return 'fa-info-circle';
            default:
                return 'fa-info-circle';
        }
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return date.toLocaleDateString();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Placeholder methods for other views
    loadServers() {
        console.log('Loading servers view...');
    }

    loadSystemView() {
        console.log('Loading system view...');
    }

    loadLogs() {
        console.log('Loading logs view...');
    }

    loadUsers() {
        console.log('Loading users view...');
    }
}

// Global functions for onclick handlers
function closeModal(modalId) {
    app.closeModal(modalId);
}

// Initialize the application
const app = new WinServerManager();