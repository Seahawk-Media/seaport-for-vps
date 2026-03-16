import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authClient } from '@/lib/auth-client';

type User = { id: string; name: string; email: string; image?: string | null };
type Session = { id: string; userId: string; token: string; expiresAt: Date };

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: { message?: string } | null }>;
  signIn: (email: string, password: string) => Promise<{ error: { message?: string } | null; data: { user: User | null } | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSession = async () => {
    try {
      const result = await authClient.getSession();
      if (result?.data?.session && result?.data?.user) {
        setUser(result.data.user as User);
        setSession({
          id: result.data.session.id,
          userId: result.data.session.userId,
          token: result.data.session.token,
          expiresAt: result.data.session.expiresAt,
        });
      } else {
        setUser(null);
        setSession(null);
      }
    } catch {
      setUser(null);
      setSession(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      const result = await authClient.signUp.email({
        email,
        password,
        name: fullName || email.split('@')[0],
      });
      if (result?.error) {
        return { error: result.error };
      }
      await fetchSession();
      return { error: null };
    } catch (error) {
      return { error: { message: error instanceof Error ? error.message : 'An unexpected error occurred' } };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const result = await authClient.signIn.email({ email, password });
      if (result?.error) {
        return { error: result.error, data: null };
      }
      await fetchSession();
      return { error: null, data: { user: result?.data?.user as User | null } };
    } catch (error) {
      return { error: { message: error instanceof Error ? error.message : 'An unexpected error occurred' }, data: null };
    }
  };

  const signOut = async () => {
    await authClient.signOut();
    setUser(null);
    setSession(null);
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
