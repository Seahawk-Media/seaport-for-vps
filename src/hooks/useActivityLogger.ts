import { useEffect, useCallback, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOrganization } from './useOrganization';

type ActivityType = 'login' | 'logout' | 'page_view' | 'action';

interface LogActivityParams {
  activityType: ActivityType;
  description?: string;
  metadata?: Record<string, unknown>;
  pagePath?: string;
}

export const useActivityLogger = () => {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const location = useLocation();
  const lastLoggedPath = useRef<string | null>(null);
  const isLogging = useRef(false);
  const [profileId, setProfileId] = useState<string | null>(null);

  // Fetch profile ID when user changes
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setProfileId(null);
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
      if (data) setProfileId(data.id);
    };
    fetchProfile();
  }, [user]);

  const logActivity = useCallback(async ({
    activityType,
    description,
    metadata = {},
    pagePath
  }: LogActivityParams) => {
    if (!user || !organization?.id || !profileId) return;

    try {
      await supabase.from('activity_logs').insert([{
        profile_id: profileId,
        organization_id: organization.id,
        activity_type: activityType,
        description,
        metadata: metadata as unknown as null,
        page_path: pagePath || location.pathname,
        user_agent: navigator.userAgent
      }]);
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  }, [user, organization?.id, profileId, location.pathname]);

  // Track page views
  useEffect(() => {
    if (!user || !organization?.id || !profileId) return;
    if (isLogging.current) return;
    if (lastLoggedPath.current === location.pathname) return;
    
    isLogging.current = true;
    lastLoggedPath.current = location.pathname;
    
    logActivity({
      activityType: 'page_view',
      description: `Viewed ${location.pathname}`,
      pagePath: location.pathname
    }).finally(() => {
      isLogging.current = false;
    });
  }, [location.pathname, user, organization?.id, profileId, logActivity]);

  return { logActivity };
};

// Standalone function for login tracking (used before hooks are available)
export const logLoginActivity = async (userId: string) => {
  try {
    // Get user's profile and organization
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, organization_id')
      .eq('user_id', userId)
      .single();

    if (!profile?.organization_id) return;

    await supabase.from('activity_logs').insert([{
      profile_id: profile.id,
      organization_id: profile.organization_id,
      activity_type: 'login',
      description: 'User logged in',
      user_agent: navigator.userAgent,
      page_path: window.location.pathname
    }]);
  } catch (error) {
    console.error('Failed to log login activity:', error);
  }
};
