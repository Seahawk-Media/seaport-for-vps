import { useState, useEffect } from 'react';
import { User, Mail, Key, ImageIcon } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
}

export const UserSettings = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url')
      .eq('user_id', user.id)
      .single();

    if (profile) {
      setProfile(profile);
      setFullName(profile.full_name);
    }
  };

  const updateProfile = async () => {
    if (!profile) return;
    
    setLoading(true);
    
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName })
      .eq('id', profile.id);

    if (error) {
      toast.error('Failed to update profile');
    } else {
      toast.success('Profile updated successfully');
      setProfile({ ...profile, full_name: fullName });
    }
    
    setLoading(false);
  };

  const sendPasswordReset = async () => {
    if (!user?.email) return;
    
    setLoading(true);
    
    const { error } = await supabase.auth.resetPasswordForEmail(user.email);
    
    if (error) {
      toast.error('Failed to send password reset email');
    } else {
      toast.success('Password reset email sent to your inbox');
    }
    
    setLoading(false);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (!profile) {
    return null;
  }

  return (
    <div className="space-y-6">

      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Manage your account preferences and information</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="account">Account</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
            </TabsList>
            
            <TabsContent value="profile" className="space-y-6">
              <div className="space-y-6">
                <div className="flex items-center gap-6 p-4 border rounded-lg">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                      {getInitials(profile.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold">{profile.full_name}</h3>
                    <p className="text-sm text-muted-foreground">{profile.email}</p>
                    <Button variant="outline" size="sm" disabled>
                      <ImageIcon className="h-4 w-4 mr-2" />
                      Upload Photo
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Photo uploads coming soon
                    </p>
                  </div>
                </div>
                
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Enter your full name"
                    />
                  </div>
                  <Button 
                    onClick={updateProfile} 
                    disabled={loading || fullName === profile.full_name}
                    className="w-fit"
                  >
                    {loading ? 'Updating...' : 'Update Profile'}
                  </Button>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="account" className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    value={profile.email}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-sm text-muted-foreground">
                    Email changes are not currently supported. Contact your administrator if you need to update your email.
                  </p>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="security" className="space-y-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Password</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Reset your account password. A reset link will be sent to {profile.email}
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={sendPasswordReset}
                    disabled={loading}
                    className="gap-2"
                  >
                    <Key className="h-4 w-4" />
                    {loading ? 'Sending...' : 'Send Password Reset Email'}
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};