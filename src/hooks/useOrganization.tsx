import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { trpc } from '@/lib/trpc';

interface Organization {
  id: string;
  name: string;
  slug: string;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  primaryColor?: string | null;
  accentColor?: string | null;
  logoUrl?: string | null;
  // Keep snake_case aliases for backward compat with existing components
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
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
  const { user } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  const orgQuery = trpc.org.get.useQuery(undefined, {
    enabled: !!user,
    retry: false,
  });

  useEffect(() => {
    if (!user) {
      setOrganization(null);
      setLoading(false);
      return;
    }

    if (orgQuery.isLoading) {
      setLoading(true);
      return;
    }

    if (orgQuery.data) {
      const org = orgQuery.data;
      setOrganization({
        ...org,
        // Snake_case aliases for backward compatibility
        created_by: org.createdBy,
        created_at: org.createdAt?.toISOString?.() ?? String(org.createdAt),
        updated_at: org.updatedAt?.toISOString?.() ?? String(org.updatedAt),
        primary_color: org.primaryColor,
        accent_color: org.accentColor,
        logo_url: org.logoUrl,
      } as Organization);
    } else {
      setOrganization(null);
    }
    setLoading(false);
  }, [user, orgQuery.data, orgQuery.isLoading]);

  const refetch = async () => {
    await orgQuery.refetch();
  };

  const value = {
    organization,
    loading,
    refetch,
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
};
