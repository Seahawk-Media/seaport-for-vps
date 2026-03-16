import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type AppRole = 'super_admin' | 'admin' | 'manager' | 'employee';

interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  assigned_by: string;
  assigned_at: string;
}

type RoleCache = {
  userId: string;
  roles: UserRole[];
  highestRole: AppRole;
  fetchedAt: number;
};

// Module-level cache to prevent sidebar/layout flicker during route changes.
let roleCache: RoleCache | null = null;

export const useRole = () => {
  const { user } = useAuth();

  const cached = user && roleCache?.userId === user.id ? roleCache : null;

  const [userRoles, setUserRoles] = useState<UserRole[]>(cached?.roles ?? []);
  const [highestRole, setHighestRole] = useState<AppRole | null>(cached?.highestRole ?? null);
  const [loading, setLoading] = useState<boolean>(user ? !cached : false);

  useEffect(() => {
    if (user) {
      // If we have cached roles for this user, render immediately and refresh silently.
      if (roleCache?.userId === user.id) {
        setUserRoles(roleCache.roles);
        setHighestRole(roleCache.highestRole);
        setLoading(false);
        fetchUserRoles({ silent: true });
      } else {
        setLoading(true);
        fetchUserRoles();
      }
    } else {
      setUserRoles([]);
      setHighestRole(null);
      setLoading(false);
    }
  }, [user]);

  const fetchUserRoles = async (opts?: { silent?: boolean }) => {
    if (!user) return;

    try {
      if (!opts?.silent) setLoading(true);

      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      
      setUserRoles(data || []);
      
      // Get highest role
      const roleHierarchy: Record<AppRole, number> = {
        super_admin: 1,
        admin: 2,
        manager: 3,
        employee: 4,
      };

      let computedHighest: AppRole = 'employee';
      if (data && data.length > 0) {
        const sortedRoles = [...data].sort(
          (a, b) => roleHierarchy[a.role as AppRole] - roleHierarchy[b.role as AppRole]
        );
        computedHighest = sortedRoles[0].role as AppRole;
      }

      setHighestRole(computedHighest);

      roleCache = {
        userId: user.id,
        roles: data || [],
        highestRole: computedHighest,
        fetchedAt: Date.now(),
      };
    } catch (error) {
      console.error('Error fetching user roles:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasRole = (role: AppRole): boolean => {
    return userRoles.some(userRole => userRole.role === role);
  };

  const isSuperAdmin = (): boolean => hasRole('super_admin');
  const isAdmin = (): boolean => hasRole('admin') || isSuperAdmin();
  const isManager = (): boolean => hasRole('manager') || isAdmin();

  const assignRole = async (userId: string, role: AppRole) => {
    try {
      const { error } = await supabase.rpc('assign_user_role', {
        target_user_id: userId,
        target_role: role
      });

      if (error) throw error;
      
      // Refresh roles if this is for current user
      if (userId === user?.id) {
        fetchUserRoles();
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error assigning role:', error);
      return { success: false, error };
    }
  };

  return {
    userRoles,
    highestRole,
    loading,
    hasRole,
    isSuperAdmin,
    isAdmin,
    isManager,
    assignRole,
    refetch: fetchUserRoles
  };
};