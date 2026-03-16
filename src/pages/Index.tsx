import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { trpc } from '@/lib/trpc';

const Index = () => {
  const { user, loading } = useAuth();
  const [redirectPath, setRedirectPath] = useState<string | null>(null);

  // Check if setup is needed
  const setupQuery = trpc.setup.status.useQuery(undefined, {
    enabled: !loading,
    retry: false,
  });

  const meQuery = trpc.profiles.me.useQuery(undefined, {
    enabled: !!user,
    retry: false,
  });

  useEffect(() => {
    if (loading || setupQuery.isLoading) return;

    // If no org exists, redirect to setup wizard
    if (setupQuery.data?.needsSetup) {
      setRedirectPath('/setup');
      return;
    }

    if (!user) {
      setRedirectPath('/auth');
      return;
    }

    if (meQuery.data) {
      setRedirectPath(`/journey/${meQuery.data.id}`);
    } else if (!meQuery.isLoading) {
      setRedirectPath('/dashboard');
    }
  }, [user, loading, setupQuery.data, setupQuery.isLoading, meQuery.data, meQuery.isLoading]);

  if (loading || !redirectPath) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return <Navigate to={redirectPath} replace />;
};

export default Index;
