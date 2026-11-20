import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User } from '@/interfaces';
import { authService } from '@/services';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  hasRole: (roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Verificar si hay una sesión guardada al cargar
    const savedUser = authService.getCurrentUser();
    if (savedUser && authService.isAuthenticated()) {
      setUser(savedUser);
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await authService.login({ username, password });

      if (response.success && response.data) {
        setUser(response.data.usuario);
        return { success: true, message: 'Inicio de sesión exitoso' };
      }

      return { success: false, message: response.message || 'Error al iniciar sesión' };
    } catch (error) {
      console.error('Error en login:', error);
      return { success: false, message: 'Error de conexión' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await authService.logout();
    } finally {
      setUser(null);
      setIsLoading(false);
    }
  }, []);

  const normalize = (value?: string) =>
    (value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const hasRole = useCallback(
    (roles: string[]) => {
      if (!user) return false;
      const userRoles = [user.rolNombre, ...(user.roles || [])]
        .map(normalize)
        .filter((r) => r.length > 0);
      // USR-03 (Reporte 7): el Supervisor (Gerente de Mantenimiento) se fusionó con el Administrador y el Superusuario
      // se eliminó; el Administrador tiene todo lo que tenían los tres (y una sesión anterior con esos roles, también)
      if (userRoles.some((r) => r === 'administrador' || r === 'superusuario' || r === 'supervisor'))
        userRoles.push('administrador', 'superusuario', 'supervisor');

      return roles.some((r) => {
        const target = normalize(r);
        return userRoles.some(
          (ur) =>
            ur === target ||
            ur.includes(target) || // "administrador del sistema" incluye "administrador"
            target.includes(ur)
        );
      });
    },
    [user]
  );

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    hasRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
}
