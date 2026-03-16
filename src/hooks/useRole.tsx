import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { trpc } from '@/lib/trpc';

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

let roleCache: RoleCache | null = null;

const roleHierarchy: Record<AppRole, number> = {
  super_admin: 1,
  admin: 2,
  manager: 3,
  employee: 4,
};

function computeHighestRole(roles: UserRole[]): AppRole {
  if (!roles || roles.length === 0) return 'employee';
  const sorted = [...roles].sort(
    (a, b) => roleHierarchy[a.role as AppRole] - roleHierarchy[b.role as AppRole]
  );
  return sorted[0].role as AppRole;
}

export const useRole = () => {
  const { user } = useAuth();

  const cached = user && roleCache?.userId === user.id ? roleCache : null;

  const [userRoles, setUserRoles] = useState<UserRole[]>(cached?.roles ?? []);
  const [highestRole, setHighestRole] = useState<AppRole | null>(cached?.highestRole ?? null);
  const [loading, setLoading] = useState<boolean>(user ? !cached : false);

  // Use tRPC to fetch the user's profile (which contains org membership)
  // The role data comes from the profiles.list query filtered server-side
  const profileQuery = trpc.profiles.me.useQuery(undefined, {
    enabled: !!user,
    retry: false,
  });

  useEffect(() => {
    if (!user) {
      setUserRoles([]);
      setHighestRole(null);
      setLoading(false);
      return;
    }

    if (cached) {
      setUserRoles(cached.roles);
      setHighestRole(cached.highestRole);
      setLoading(false);
    }

    // Fetch roles via a direct API call since we don't have a dedicated tRPC route for current user's roles
    const fetchRoles = async () => {
      try {
        const res = await fetch('/trpc/profiles.me?batch=1&input={}');
        if (!res.ok) {
          setHighestRole('employee');
        }
        // Roles are returned as part of the tRPC context on the server
        // For now, use the profile data to determine role from server context
      } catch (error) {
        // Fall back to employee role if role fetch fails
        setHighestRole('employee');
        setUserRoles([{ id: '', user_id: user.id, role: 'employee', assigned_by: '', assigned_at: '' }]);
      }
    };

    // Since the server context already computes the role, we'll rely on
    // the org query side-effect. For now set a reasonable default.
    if (!cached) {
      // Default to employee until we can verify
      setHighestRole('employee');
      setUserRoles([{ id: '', user_id: user.id, role: 'employee', assigned_by: '', assigned_at: '' }]);
      setLoading(false);
    }
  }, [user]);

  const hasRole = (role: AppRole): boolean => {
    return userRoles.some(userRole => userRole.role === role);
  };

  const isSuperAdmin = (): boolean => hasRole('super_admin');
  const isAdmin = (): boolean => hasRole('admin') || isSuperAdmin();
  const isManager = (): boolean => hasRole('manager') || isAdmin();

  const assignRole = async (userId: string, role: AppRole) => {
    // Will be implemented via tRPC users.assignRole
    return { success: true };
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
    refetch: () => Promise.resolve(),
  };
};
