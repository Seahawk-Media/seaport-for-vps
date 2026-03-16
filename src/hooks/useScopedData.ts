import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { useOrganization } from '@/hooks/useOrganization';
import { supabase } from '@/integrations/supabase/client';
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

  // Admins viewing 'team' scope see org-wide
  const effectiveScope = (scope === 'team' && isAdmin()) ? 'org' : scope;
  const canApprove = scope !== 'personal' && (isManager() || isAdmin());

  useEffect(() => {
    const fetchScopedProfiles = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Get current user's profile
        const { data: currentProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (!currentProfile) {
          setLoading(false);
          return;
        }

        setCurrentProfileId(currentProfile.id);

        if (scope === 'personal') {
          setProfileIds([currentProfile.id]);
        } else if (effectiveScope === 'org') {
          // Admin: get all profiles in organization
          const { data: orgProfiles } = await supabase
            .from('profiles')
            .select('id')
            .eq('organization_id', organization?.id);
          
          setProfileIds(orgProfiles?.map(p => p.id) || []);
        } else {
          // Manager: get direct reports
          const { data: directReports } = await supabase
            .from('profiles')
            .select('id')
            .eq('manager_id', currentProfile.id);
          
          setProfileIds(directReports?.map(p => p.id) || []);
        }
      } catch (error) {
        console.error('Error fetching scoped profiles:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchScopedProfiles();
  }, [user, scope, effectiveScope, organization?.id]);

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
