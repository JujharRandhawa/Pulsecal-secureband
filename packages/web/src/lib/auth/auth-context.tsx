'use client';

import { useRouter } from 'next/navigation';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

import { authService } from './auth-service';
import type { Session } from './types';

interface AuthContextType {
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (jailName: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const INACTIVITY_TIMEOUT = 8 * 60 * 60 * 1000; // 8 hours (matches backend session duration)
const INACTIVITY_CHECK_INTERVAL = 60 * 1000; // Check every minute

export function AuthProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  // Pathname reserved for future use: usePathname()

  const handleLogout = useCallback(async (): Promise<void> => {
    try {
      if (session?.token) {
        await authService.logout(session.token);
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      authService.clearSession();
      setSession(null);
      router.push('/login');
    }
  }, [session, router]);

  // Load session from storage on mount
  useEffect(() => {
    const loadSession = async (): Promise<void> => {
      try {
        const storedSession = authService.getStoredSession();
        if (storedSession) {
          // Validate session with backend
          const isValid = await authService.validateSession(storedSession.token);
          if (isValid) {
            setSession(storedSession);
          } else {
            authService.clearSession();
          }
        }
      } catch (error) {
        console.error('Failed to load session:', error);
        authService.clearSession();
      } finally {
        setIsLoading(false);
      }
    };

    void loadSession();
  }, []);

  // Handle inactivity timeout
  useEffect(() => {
    if (!session) return;

    let lastActivity = Date.now();

    const updateActivity = (): void => {
      lastActivity = Date.now();
    };

    const checkInactivity = (): void => {
      const timeSinceActivity = Date.now() - lastActivity;
      if (timeSinceActivity >= INACTIVITY_TIMEOUT) {
        void handleLogout();
      }
    };

    // Track user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach((event) => {
      window.addEventListener(event, updateActivity, { passive: true });
    });

    // Check inactivity periodically
    const inactivityInterval = setInterval(checkInactivity, INACTIVITY_CHECK_INTERVAL);

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, updateActivity);
      });
      clearInterval(inactivityInterval);
    };
  }, [session, handleLogout]);

  // Check session expiration
  useEffect(() => {
    if (!session) return;

    const checkExpiration = (): void => {
      if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
        void handleLogout();
      }
    };

    const expirationInterval = setInterval(checkExpiration, 60000); // Check every minute

    return () => clearInterval(expirationInterval);
  }, [session, handleLogout]);

  const login = useCallback(async (jailName: string, password: string): Promise<void> => {
    const newSession = await authService.login(jailName, password);
    setSession(newSession);
    authService.storeSession(newSession);
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    await handleLogout();
  }, [handleLogout]);

  const refreshSession = useCallback(async (): Promise<void> => {
    if (!session) return;

    try {
      const isValid = await authService.validateSession(session.token);
      if (!isValid) {
        await handleLogout();
      }
    } catch (error) {
      console.error('Session refresh error:', error);
      await handleLogout();
    }
  }, [session, handleLogout]);

  const value: AuthContextType = {
    session,
    isLoading,
    isAuthenticated: !!session,
    login,
    logout,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
