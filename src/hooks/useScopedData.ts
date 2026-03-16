import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { useOrganization } from '@/hooks/useOrganization';
import { trpc } from '@/lib/trpc';
import { DataScope } from '@/types/scope';

interface ScopedDataResult {
  currentProfileId: string | null;
  profileIds: string[];
  organizationId: string | null;
  scope: DataScope;
  effectiveScope: DataScope;
  loading: boolean;
  canApprove: boolean;
}

export function useScopedData(scope: DataScope): ScopedDataResult {
  const { user } = useAuth();
  const { isAdmin, isManager } = useRole();
  const { organization } = useOrganization();
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [profileIds, setProfileIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const effectiveScope = (scope === 'team' && isAdmin()) ? 'org' : scope;
  const canApprove = scope !== 'personal' && (isManager() || isAdmin());

  const meQuery = trpc.profiles.me.useQuery(undefined, {
    enabled: !!user,
  });

  const profilesQuery = trpc.profiles.list.useQuery(undefined, {
    enabled: !!user && effectiveScope === 'org',
  });

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    if (meQuery.isLoading) return;

    if (meQuery.data) {
      setCurrentProfileId(meQuery.data.id);

      if (scope === 'personal') {
        setProfileIds([meQuery.data.id]);
      } else if (effectiveScope === 'org' && profilesQuery.data) {
        setProfileIds(profilesQuery.data.map((p: any) => p.id));
      } else {
        // Manager scope — direct reports (filtered by managerId)
        if (profilesQuery.data) {
          const reports = profilesQuery.data.filter((p: any) => p.managerId === meQuery.data?.id);
          setProfileIds(reports.map((p: any) => p.id));
        }
      }
    }

    setLoading(false);
  }, [user, scope, effectiveScope, meQuery.data, meQuery.isLoading, profilesQuery.data]);

  return {
    currentProfileId,
    profileIds,
    organizationId: organization?.id || null,
    scope,
    effectiveScope,
    loading,
    canApprove,
  };
}
