"use client";

/**
 * Re-export useAuth from providers for convenience
 * 
 * Usage:
 * import { useAuth } from '@/hooks/use-auth';
 * 
 * const { user, isAuthenticated, login, logout, isAdmin, hasRole } = useAuth();
 */

export { useAuth } from "@/providers/auth-provider";
export type { UserRole } from "@/providers/auth-provider";