import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Organization {
  id: string;
  name: string;
  slug: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  primary_color?: string | null;
  accent_color?: string | null;
  logo_url?: string | null;
}

interface OrganizationContextType {
  organization: Organization | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
};

interface OrganizationProviderProps {
  children: ReactNode;
}

export const OrganizationProvider = ({ children }: OrganizationProviderProps) => {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchOrganization = async () => {
    if (!user) {
      setOrganization(null);
      setLoading(false);
      return;
    }

    try {
      // First get the user's profile to find their organization
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile?.organization_id) {
        setOrganization(null);
        setLoading(false);
        return;
      }

      // Then fetch the organization details
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', profile.organization_id)
        .single();

      if (orgError) throw orgError;

      setOrganization(org);
    } catch (error) {
      console.error('Error fetching organization:', error);
      setOrganization(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Reset loading state when user changes to prevent flash of org setup
    setLoading(true);
    fetchOrganization();
  }, [user]);

  const value = {
    organization,
    loading,
    refetch: fetchOrganization,
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
};