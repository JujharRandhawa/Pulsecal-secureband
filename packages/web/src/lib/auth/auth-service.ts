import type { Session, LoginResponse } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const SESSION_STORAGE_KEY = 'pulsecal_session';

class AuthService {
  /**
   * Login with jail name and password
   */
  async login(jailName: string, password: string): Promise<Session> {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jailName, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { message?: string };
        
        if (response.status === 401) {
          throw new Error('Invalid jail name or password');
        } else if (response.status === 429) {
          throw new Error('Too many login attempts. Please try again later.');
        } else if (response.status === 403) {
          throw new Error('Access denied: IP address not allowed');
        } else {
          throw new Error(errorData.message || 'Login failed. Please try again.');
        }
      }

      const data = await response.json() as LoginResponse;
      
      const session: Session = {
        token: data.token,
        expiresAt: new Date(data.expiresAt),
        jailName: data.jailName,
      };

      return session;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Network error. Please check your connection and try again.');
    }
  }

  /**
   * Logout and invalidate session
   */
  async logout(token: string): Promise<void> {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      // Log error but don't throw - we'll clear local session anyway
      console.error('Logout request failed:', error);
    }
  }

  /**
   * Validate session token with backend
   */
  async validateSession(token: string): Promise<boolean> {
    try {
      // Use a lightweight endpoint to validate session
      // You can create a /auth/validate endpoint or use an existing protected endpoint
      const response = await fetch(`${API_URL}/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Session validation error:', error);
      return false;
    }
  }

  /**
   * Store session in localStorage
   */
  storeSession(session: Session): void {
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch (error) {
      console.error('Failed to store session:', error);
    }
  }

  /**
   * Get stored session from localStorage
   */
  getStoredSession(): Session | null {
    try {
      const stored = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!stored) return null;

      const session = JSON.parse(stored) as Session;
      
      // Check if session is expired
      if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
        this.clearSession();
        return null;
      }

      return session;
    } catch (error) {
      console.error('Failed to get stored session:', error);
      this.clearSession();
      return null;
    }
  }

  /**
   * Clear session from localStorage
   */
  clearSession(): void {
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear session:', error);
    }
  }
}

export const authService = new AuthService();
