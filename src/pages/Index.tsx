import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [redirectPath, setRedirectPath] = useState<string | null>(null);

  useEffect(() => {
    const getMyJourneyPath = async () => {
      if (!user) {
        setRedirectPath('/auth');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        setRedirectPath(`/journey/${profile.id}`);
      } else {
        // No profile yet - go to dashboard for org setup
        setRedirectPath('/dashboard');
      }
    };

    if (!loading) {
      getMyJourneyPath();
    }
  }, [user, loading]);

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
