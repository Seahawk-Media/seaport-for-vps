import { useAuth } from './useAuth';
import { trpc } from '@/lib/trpc';

export type AppRole = 'super_admin' | 'admin' | 'manager' | 'employee';

const roleHierarchy: Record<AppRole, number> = {
  super_admin: 1,
  admin: 2,
  manager: 3,
  employee: 4,
};

export const useRole = () => {
  const { user } = useAuth();

  const roleQuery = trpc.users.myRole.useQuery(undefined, {
    enabled: !!user,
    retry: false,
    staleTime: 5 * 60 * 1000, // cache for 5 minutes
  });

  const role = (roleQuery.data?.role as AppRole) ?? null;
  const loading = roleQuery.isLoading;

  const hasRole = (checkRole: AppRole): boolean => {
    if (!role) return false;
    return role === checkRole;
  };

  const hasRoleOrHigher = (checkRole: AppRole): boolean => {
    if (!role) return false;
    return roleHierarchy[role] <= roleHierarchy[checkRole];
  };

  const isSuperAdmin = (): boolean => role === 'super_admin';
  const isAdmin = (): boolean => hasRoleOrHigher('admin');
  const isManager = (): boolean => hasRoleOrHigher('manager');

  return {
    userRoles: role ? [{ id: '', user_id: user?.id ?? '', role, assigned_by: '', assigned_at: '' }] : [],
    highestRole: role,
    loading,
    hasRole,
    isSuperAdmin,
    isAdmin,
    isManager,
    assignRole: async () => ({ success: true }),
    refetch: () => roleQuery.refetch(),
  };
};
