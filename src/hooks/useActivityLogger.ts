import { useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';
import { useOrganization } from './useOrganization';
import { trpc } from '@/lib/trpc';

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

  const createActivity = trpc.activity.create.useMutation();

  const logActivity = useCallback(async ({
    activityType,
    description,
    metadata = {},
    pagePath
  }: LogActivityParams) => {
    if (!user || !organization?.id) return;

    try {
      createActivity.mutate({
        activityType,
        description: description || `${activityType}: ${pagePath || location.pathname}`,
        metadata,
        pagePath: pagePath || location.pathname,
      });
    } catch {
      // Activity logging is non-critical; silently ignore failures
    }
  }, [user, organization?.id, location.pathname, createActivity]);

  // Track page views
  useEffect(() => {
    if (!user || !organization?.id) return;
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
  }, [location.pathname, user, organization?.id, logActivity]);

  return { logActivity };
};

// Standalone function for login tracking
export const logLoginActivity = async (userId: string) => {
  try {
    await fetch('/trpc/activity.create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activityType: 'login',
        description: 'User logged in',
        pagePath: window.location.pathname,
      }),
    });
  } catch {
    // Login activity logging is non-critical; silently ignore failures
  }
};
