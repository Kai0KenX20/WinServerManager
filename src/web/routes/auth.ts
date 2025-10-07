import { Router, Request, Response } from 'express';
import { DatabaseService } from '../../services/database.js';
import { AuthService } from '../services/authService.js';

interface AuthRequest extends Request {
    database: DatabaseService;
    authService: AuthService;
    session: any;
}

const router = Router();

// POST /api/auth/login - User login
router.post('/login', async (req: AuthRequest, res: Response) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        
        const session = await req.authService.authenticateUser(username, password);
        
        if (!session) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        
        // Store session info
        req.session.userId = session.userId;
        req.session.username = session.username;
        req.session.role = session.role;
        
        res.json({
            message: 'Login successful',
            user: {
                id: session.userId,
                username: session.username,
                role: session.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// POST /api/auth/logout - User logout
router.post('/logout', async (req: AuthRequest, res: Response) => {
    try {
        if (req.session && req.session.userId) {
            req.authService.logout(req.session.userId);
            req.session.destroy((err) => {
                if (err) {
                    console.error('Session destroy error:', err);
                }
            });
        }
        
        res.json({ message: 'Logout successful' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Logout failed' });
    }
});

// GET /api/auth/me - Get current user info
router.get('/me', async (req: AuthRequest, res: Response) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        
        const session = req.authService.getSession(req.session.userId);
        if (!session) {
            return res.status(401).json({ error: 'Invalid session' });
        }
        
        const user = await req.database.getUserById(req.session.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                lastLogin: user.lastLogin,
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        console.error('Error fetching user info:', error);
        res.status(500).json({ error: 'Failed to fetch user info' });
    }
});

// POST /api/auth/change-password - Change password
router.post('/change-password', async (req: AuthRequest, res: Response) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current password and new password are required' });
        }
        
        const success = await req.authService.changePassword(
            req.session.userId,
            currentPassword,
            newPassword
        );
        
        if (!success) {
            return res.status(400).json({ error: 'Invalid current password' });
        }
        
        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({ 
            error: 'Failed to change password',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// POST /api/auth/reset-password - Reset password (admin only)
router.post('/reset-password', async (req: AuthRequest, res: Response) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        
        if (!req.authService.hasPermission(req.session.userId, 'admin')) {
            return res.status(403).json({ error: 'Admin permission required' });
        }
        
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        
        const tempPassword = await req.authService.resetPassword(email);
        
        if (!tempPassword) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ 
            message: 'Password reset successfully',
            tempPassword: tempPassword 
        });
    } catch (error) {
        console.error('Password reset error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

// GET /api/auth/users - Get all users (admin only)
router.get('/users', async (req: AuthRequest, res: Response) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        
        if (!req.authService.hasPermission(req.session.userId, 'admin')) {
            return res.status(403).json({ error: 'Admin permission required' });
        }
        
        const users = await req.database.getUsers();
        
        // Remove password hashes from response
        const safeUsers = users.map(user => ({
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
            lastLogin: user.lastLogin,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        }));
        
        res.json({ users: safeUsers });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// POST /api/auth/users - Create new user (admin only)
router.post('/users', async (req: AuthRequest, res: Response) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        
        if (!req.authService.hasPermission(req.session.userId, 'admin')) {
            return res.status(403).json({ error: 'Admin permission required' });
        }
        
        const { username, email, password, role = 'user' } = req.body;
        
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Username, email, and password are required' });
        }
        
        const user = await req.authService.createUser(username, email, password, role);
        
        res.status(201).json({
            message: 'User created successfully',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                isActive: user.isActive,
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        console.error('User creation error:', error);
        res.status(500).json({ 
            error: 'Failed to create user',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// PUT /api/auth/users/:id/role - Update user role (admin only)
router.put('/users/:id/role', async (req: AuthRequest, res: Response) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        
        if (!req.authService.hasPermission(req.session.userId, 'admin')) {
            return res.status(403).json({ error: 'Admin permission required' });
        }
        
        const { id } = req.params;
        const { role } = req.body;
        
        if (!role || !['admin', 'moderator', 'user'].includes(role)) {
            return res.status(400).json({ error: 'Valid role is required (admin, moderator, user)' });
        }
        
        const success = await req.authService.updateUserRole(req.session.userId, id, role);
        
        if (!success) {
            return res.status(404).json({ error: 'User not found or update failed' });
        }
        
        res.json({ message: 'User role updated successfully' });
    } catch (error) {
        console.error('Role update error:', error);
        res.status(500).json({ error: 'Failed to update user role' });
    }
});

// DELETE /api/auth/users/:id - Deactivate user (admin only)
router.delete('/users/:id', async (req: AuthRequest, res: Response) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        
        if (!req.authService.hasPermission(req.session.userId, 'admin')) {
            return res.status(403).json({ error: 'Admin permission required' });
        }
        
        const { id } = req.params;
        
        // Prevent admin from deactivating themselves
        if (id === req.session.userId) {
            return res.status(400).json({ error: 'Cannot deactivate your own account' });
        }
        
        const success = await req.authService.deactivateUser(req.session.userId, id);
        
        if (!success) {
            return res.status(404).json({ error: 'User not found or deactivation failed' });
        }
        
        res.json({ message: 'User deactivated successfully' });
    } catch (error) {
        console.error('User deactivation error:', error);
        res.status(500).json({ error: 'Failed to deactivate user' });
    }
});

// GET /api/auth/active-sessions - Get active sessions (admin only)
router.get('/active-sessions', async (req: AuthRequest, res: Response) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        
        if (!req.authService.hasPermission(req.session.userId, 'admin')) {
            return res.status(403).json({ error: 'Admin permission required' });
        }
        
        const activeSessions = req.authService.getActiveUsers();
        
        res.json({ sessions: activeSessions });
    } catch (error) {
        console.error('Error fetching active sessions:', error);
        res.status(500).json({ error: 'Failed to fetch active sessions' });
    }
});

export default router;