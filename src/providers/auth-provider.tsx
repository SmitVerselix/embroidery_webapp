'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode
} from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout
} from '@/lib/api/services';
import { getError } from '@/lib/api/axios';
import type { User, AuthPayload, UserCompany } from '@/lib/api/types';

// =============================================================================
// TYPES
// =============================================================================

export type UserRole = 'admin' | 'user' | 'owner';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  currentCompany: UserCompany | null;
  companies: UserCompany[];
  login: (email: string, password: string) => Promise<AuthPayload>;
  register: (
    name: string,
    email: string,
    password: string,
    roleId?: string
  ) => Promise<AuthPayload>;
  logout: () => Promise<void>;
  setCurrentCompany: (company: UserCompany | null) => void;
  setCompanies: (companies: UserCompany[]) => void;
  clearCurrentCompany: () => void;
  error: string | null;
  clearError: () => void;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: UserRole | string) => boolean;
  isCompanyOwner: () => boolean;
  isAdmin: () => boolean;
  userRole: UserRole | null;
  needsCompanySelection: boolean;
}

// =============================================================================
// CONTEXT
// =============================================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// =============================================================================
// COOKIE HELPERS
// =============================================================================

const setCookie = (name: string, value: string, days: number = 7) => {
  if (typeof window === 'undefined') return;
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
};

const deleteCookie = (name: string) => {
  if (typeof window === 'undefined') return;
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
};

// =============================================================================
// STORAGE HELPERS
// =============================================================================

export const getStoredUser = (): User | null => {
  if (typeof window === 'undefined') return null;
  try {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    return JSON.parse(userStr);
  } catch {
    return null;
  }
};

export const getStoredToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
};

export const getStoredCompany = (): UserCompany | null => {
  if (typeof window === 'undefined') return null;
  try {
    const companyStr = localStorage.getItem('currentCompany');
    if (!companyStr) return null;
    return JSON.parse(companyStr);
  } catch {
    return null;
  }
};

export const getStoredCompanies = (): UserCompany[] => {
  if (typeof window === 'undefined') return [];
  try {
    const companiesStr = localStorage.getItem('companies');
    if (!companiesStr) return [];
    return JSON.parse(companiesStr);
  } catch {
    return [];
  }
};

// =============================================================================
// ROUTE HELPERS
// =============================================================================

const PUBLIC_ROUTES = ['/auth', '/invite', '/terms', '/privacy'];

const isPublicRoute = (pathname: string): boolean => {
  if (pathname === '/') return true;
  return PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
};

const isSelectCompanyRoute = (pathname: string): boolean => {
  return pathname.includes('/select-company');
};

const getCompanyIdFromPath = (pathname: string): string | null => {
  // Match /dashboard/[companyId]/...
  const match = pathname.match(/^\/dashboard\/([^\/]+)/);
  if (match && match[1] !== 'select-company') {
    return match[1];
  }
  return null;
};

// =============================================================================
// PROVIDER
// =============================================================================

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [currentCompany, setCurrentCompanyState] = useState<UserCompany | null>(
    null
  );
  const [companies, setCompaniesState] = useState<UserCompany[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const userRole: UserRole | null = (user?.role?.name as UserRole) || null;

  // Check if user needs to select a company
  const needsCompanySelection = !!token && !!user && !currentCompany;

  // Initialize auth state from localStorage
  useEffect(() => {
    const initAuth = () => {
      const storedUser = getStoredUser();
      const storedToken = getStoredToken();
      const storedCompany = getStoredCompany();
      const storedCompanies = getStoredCompanies();

      if (storedUser && storedToken) {
        setUser(storedUser);
        setToken(storedToken);
        setCookie('token', storedToken);

        if (storedCompanies.length > 0) {
          setCompaniesState(storedCompanies);
        }

        if (storedCompany) {
          setCurrentCompanyState(storedCompany);
        }
      }

      setIsLoading(false);
      setIsInitialized(true);
    };

    initAuth();
  }, []);

  // Handle route protection
  useEffect(() => {
    if (!isInitialized || isLoading) return;

    const isPublic = isPublicRoute(pathname);
    const hasAuth = !!token && !!user;
    const isOnSelectCompany = isSelectCompanyRoute(pathname);
    const pathCompanyId = getCompanyIdFromPath(pathname);

    // If not authenticated and not on public route, redirect to sign-in
    if (!hasAuth && !isPublic) {
      router.replace('/auth/sign-in');
      return;
    }

    // If authenticated but no company selected and not on select-company page
    if (hasAuth && !currentCompany && !isOnSelectCompany && !isPublic) {
      router.replace('/dashboard/select-company');
      return;
    }

    // If on a company route but company ID doesn't match current company
    if (
      hasAuth &&
      currentCompany &&
      pathCompanyId &&
      pathCompanyId !== currentCompany.company.id
    ) {
      // Could either:
      // 1. Redirect to correct company URL
      // 2. Switch to the company in URL
      // For now, redirect to current company's dashboard
      router.replace(`/dashboard/${currentCompany.company.id}/overview`);
      return;
    }
  }, [isInitialized, isLoading, token, user, currentCompany, pathname, router]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const setCurrentCompany = useCallback((company: UserCompany | null) => {
    setCurrentCompanyState(company);
    if (company) {
      localStorage.setItem('currentCompany', JSON.stringify(company));
      // Redirect to dashboard with company ID in URL
      window.location.href = `/dashboard/${company.company.id}/overview`;
    } else {
      localStorage.removeItem('currentCompany');
    }
  }, []);

  const clearCurrentCompany = useCallback(() => {
    setCurrentCompanyState(null);
    localStorage.removeItem('currentCompany');
    window.location.href = '/dashboard/select-company';
  }, []);

  const setCompanies = useCallback((companiesList: UserCompany[]) => {
    setCompaniesState(companiesList);
    localStorage.setItem('companies', JSON.stringify(companiesList));
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<AuthPayload> => {
      setIsLoading(true);
      setError(null);

      try {
        const payload = await apiLogin(email, password);

        setUser(payload.user);
        setToken(payload.token);
        setCookie('token', payload.token);

        setIsLoading(false);

        // Redirect to company selection
        window.location.href = '/dashboard/select-company';

        return payload;
      } catch (err) {
        const errorMessage = getError(err);
        setError(errorMessage);
        setIsLoading(false);
        throw new Error(errorMessage);
      }
    },
    []
  );

  const register = useCallback(
    async (
      name: string,
      email: string,
      password: string,
      roleId?: string
    ): Promise<AuthPayload> => {
      setIsLoading(true);
      setError(null);

      try {
        const payload = await apiRegister(name, email, password, roleId);

        setUser(payload.user);
        setToken(payload.token);
        setCookie('token', payload.token);

        setIsLoading(false);

        // Redirect to company selection
        window.location.href = '/dashboard/select-company';

        return payload;
      } catch (err) {
        const errorMessage = getError(err);
        setError(errorMessage);
        setIsLoading(false);
        throw new Error(errorMessage);
      }
    },
    []
  );

  const logout = useCallback(async () => {
    setIsLoading(true);

    try {
      await apiLogout();
    } catch {
      // Ignore logout errors
    } finally {
      setUser(null);
      setToken(null);
      setCurrentCompanyState(null);
      setCompaniesState([]);

      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('currentCompany');
      localStorage.removeItem('companies');

      deleteCookie('token');

      setIsLoading(false);

      window.location.href = '/auth/sign-in';
    }
  }, []);

  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (!user) return false;
      if (userRole === 'admin' || userRole === 'owner') return true;
      if (
        currentCompany?.role?.name === 'admin' ||
        currentCompany?.role?.name === 'owner'
      )
        return true;
      return false;
    },
    [user, userRole, currentCompany]
  );

  const hasRole = useCallback(
    (role: UserRole | string): boolean => {
      if (!user) return false;
      if (userRole === role) return true;
      if (currentCompany?.role?.name === role) return true;
      return false;
    },
    [user, userRole, currentCompany]
  );

  const isCompanyOwner = useCallback((): boolean => {
    return hasRole('owner');
  }, [hasRole]);

  const isAdmin = useCallback((): boolean => {
    return userRole === 'admin' || hasRole('admin') || hasRole('owner');
  }, [userRole, hasRole]);

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated: !!token && !!user,
    currentCompany,
    companies,
    login,
    register,
    logout,
    setCurrentCompany,
    setCompanies,
    clearCurrentCompany,
    error,
    clearError,
    hasPermission,
    hasRole,
    isCompanyOwner,
    isAdmin,
    userRole,
    needsCompanySelection
  };

  if (!isInitialized) {
    return (
      <div className='flex h-screen items-center justify-center'>
        <div className='border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent' />
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// =============================================================================
// HOOK
// =============================================================================

export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
