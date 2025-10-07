import bcrypt from 'bcrypt';
import { DatabaseService } from '../../services/database.js';
import { User, UserRole } from '../../types/index.js';

export interface AuthSession {
    userId: string;
    username: string;
    role: UserRole;
    isAuthenticated: boolean;
    loginTime: Date;
    lastActivity: Date;
}

export class AuthService {
    private database: DatabaseService;
    private activeSessions: Map<string, AuthSession> = new Map();
    private readonly saltRounds = 12;

    constructor(database: DatabaseService) {
        this.database = database;
    }

    public async createUser(username: string, email: string, password: string, role: UserRole = 'user'): Promise<User> {
        // Check if user already exists
        const existingUser = await this.database.getUserByUsername(username);
        if (existingUser) {
            throw new Error('Username already exists');
        }

        const existingEmail = await this.database.getUserByEmail(email);
        if (existingEmail) {
            throw new Error('Email already exists');
        }

        // Validate password strength
        this.validatePassword(password);

        // Hash password
        const hashedPassword = await bcrypt.hash(password, this.saltRounds);

        // Create user
        const user: User = {
            id: crypto.randomUUID(),
            username,
            email,
            passwordHash: hashedPassword,
            role,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastLogin: null
        };

        await this.database.saveUser(user);
        
        // Return user without password hash
        const { passwordHash, ...safeUser } = user;
        return safeUser as User;
    }

    public async authenticateUser(username: string, password: string): Promise<AuthSession | null> {
        try {
            const user = await this.database.getUserByUsername(username);
            if (!user || !user.isActive) {
                return null;
            }

            // Verify password
            const isValidPassword = await bcrypt.compare(password, user.passwordHash);
            if (!isValidPassword) {
                return null;
            }

            // Update last login
            user.lastLogin = new Date();
            user.updatedAt = new Date();
            await this.database.saveUser(user);

            // Create session
            const session: AuthSession = {
                userId: user.id,
                username: user.username,
                role: user.role,
                isAuthenticated: true,
                loginTime: new Date(),
                lastActivity: new Date()
            };

            this.activeSessions.set(user.id, session);
            return session;

        } catch (error) {
            console.error('Authentication error:', error);
            return null;
        }
    }

    public async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean> {
        try {
            const user = await this.database.getUserById(userId);
            if (!user) {
                return false;
            }

            // Verify current password
            const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
            if (!isValidPassword) {
                return false;
            }

            // Validate new password
            this.validatePassword(newPassword);

            // Hash new password
            const hashedPassword = await bcrypt.hash(newPassword, this.saltRounds);

            // Update user
            user.passwordHash = hashedPassword;
            user.updatedAt = new Date();
            await this.database.saveUser(user);

            return true;

        } catch (error) {
            console.error('Password change error:', error);
            return false;
        }
    }

    public async resetPassword(email: string): Promise<string | null> {
        try {
            const user = await this.database.getUserByEmail(email);
            if (!user) {
                return null;
            }

            // Generate temporary password
            const tempPassword = this.generateTempPassword();
            const hashedPassword = await bcrypt.hash(tempPassword, this.saltRounds);

            // Update user
            user.passwordHash = hashedPassword;
            user.updatedAt = new Date();
            await this.database.saveUser(user);

            return tempPassword;

        } catch (error) {
            console.error('Password reset error:', error);
            return null;
        }
    }

    public getSession(userId: string): AuthSession | null {
        return this.activeSessions.get(userId) || null;
    }

    public updateSessionActivity(userId: string): void {
        const session = this.activeSessions.get(userId);
        if (session) {
            session.lastActivity = new Date();
        }
    }

    public logout(userId: string): void {
        this.activeSessions.delete(userId);
    }

    public logoutAll(): void {
        this.activeSessions.clear();
    }

    public hasPermission(userId: string, requiredRole: UserRole): boolean {
        const session = this.getSession(userId);
        if (!session || !session.isAuthenticated) {
            return false;
        }

        // Role hierarchy: admin > moderator > user
        const roleHierarchy = {
            'admin': 3,
            'moderator': 2,
            'user': 1
        };

        return roleHierarchy[session.role] >= roleHierarchy[requiredRole];
    }

    public async updateUserRole(adminUserId: string, targetUserId: string, newRole: UserRole): Promise<boolean> {
        try {
            // Check if admin has permission
            if (!this.hasPermission(adminUserId, 'admin')) {
                return false;
            }

            const targetUser = await this.database.getUserById(targetUserId);
            if (!targetUser) {
                return false;
            }

            // Update role
            targetUser.role = newRole;
            targetUser.updatedAt = new Date();
            await this.database.saveUser(targetUser);

            // Update active session if exists
            const session = this.getSession(targetUserId);
            if (session) {
                session.role = newRole;
            }

            return true;

        } catch (error) {
            console.error('Role update error:', error);
            return false;
        }
    }

    public async deactivateUser(adminUserId: string, targetUserId: string): Promise<boolean> {
        try {
            // Check if admin has permission
            if (!this.hasPermission(adminUserId, 'admin')) {
                return false;
            }

            const targetUser = await this.database.getUserById(targetUserId);
            if (!targetUser) {
                return false;
            }

            // Deactivate user
            targetUser.isActive = false;
            targetUser.updatedAt = new Date();
            await this.database.saveUser(targetUser);

            // Logout user if active
            this.logout(targetUserId);

            return true;

        } catch (error) {
            console.error('User deactivation error:', error);
            return false;
        }
    }

    public getActiveUsers(): AuthSession[] {
        return Array.from(this.activeSessions.values());
    }

    public isSessionExpired(userId: string, maxInactivityMinutes: number = 60): boolean {
        const session = this.getSession(userId);
        if (!session) {
            return true;
        }

        const inactivityMs = Date.now() - session.lastActivity.getTime();
        const maxInactivityMs = maxInactivityMinutes * 60 * 1000;

        return inactivityMs > maxInactivityMs;
    }

    public cleanupExpiredSessions(maxInactivityMinutes: number = 60): void {
        const expiredUserIds: string[] = [];
        
        for (const [userId, session] of this.activeSessions) {
            if (this.isSessionExpired(userId, maxInactivityMinutes)) {
                expiredUserIds.push(userId);
            }
        }

        for (const userId of expiredUserIds) {
            this.logout(userId);
        }

        if (expiredUserIds.length > 0) {
            console.log(`Cleaned up ${expiredUserIds.length} expired sessions`);
        }
    }

    private validatePassword(password: string): void {
        if (password.length < 8) {
            throw new Error('Password must be at least 8 characters long');
        }

        if (!/(?=.*[a-z])/.test(password)) {
            throw new Error('Password must contain at least one lowercase letter');
        }

        if (!/(?=.*[A-Z])/.test(password)) {
            throw new Error('Password must contain at least one uppercase letter');
        }

        if (!/(?=.*\d)/.test(password)) {
            throw new Error('Password must contain at least one number');
        }

        if (!/(?=.*[@$!%*?&])/.test(password)) {
            throw new Error('Password must contain at least one special character (@$!%*?&)');
        }
    }

    private generateTempPassword(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@$!%*?&';
        let result = '';
        
        // Ensure at least one of each required type
        result += 'A'; // Uppercase
        result += 'a'; // Lowercase
        result += '1'; // Number
        result += '@'; // Special
        
        // Fill remaining positions
        for (let i = 4; i < 12; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        // Shuffle the result
        return result.split('').sort(() => Math.random() - 0.5).join('');
    }

    // Initialize default admin user if no users exist
    public async initializeDefaultAdmin(): Promise<void> {
        try {
            const users = await this.database.getUsers();
            if (users.length === 0) {
                const defaultPassword = 'WinAdmin@2024';
                await this.createUser('admin', 'admin@winservermanager.local', defaultPassword, 'admin');
                console.log('Created default admin user: admin / WinAdmin@2024');
                console.log('IMPORTANT: Change the default password after first login!');
            }
        } catch (error) {
            console.error('Failed to initialize default admin:', error);
        }
    }
}
