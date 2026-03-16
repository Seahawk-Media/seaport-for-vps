import { useState, useEffect } from 'react';
import { User, Mail, Key, ImageIcon } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

export const UserSettings = () => {
  const { user } = useAuth();
  const [fullName, setFullName] = useState('');

  const meQuery = trpc.profiles.me.useQuery(undefined, {
    enabled: !!user,
    retry: false,
  });

  const utils = trpc.useUtils();

  const updateMutation = trpc.profiles.update.useMutation({
    onSuccess: () => {
      toast.success('Profile updated successfully');
      utils.profiles.me.invalidate();
    },
    onError: () => {
      toast.error('Failed to update profile');
    },
  });

  const profile = meQuery.data;

  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName || '');
    }
  }, [profile]);

  const updateProfile = () => {
    updateMutation.mutate({ fullName });
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
                    <AvatarImage src={profile.avatarUrl || undefined} alt={profile.fullName || ''} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                      {getInitials(profile.fullName || '')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold">{profile.fullName}</h3>
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
                    disabled={updateMutation.isPending || fullName === (profile.fullName || '')}
                    className="w-fit"
                  >
                    {updateMutation.isPending ? 'Updating...' : 'Update Profile'}
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
                    value={profile.email || ''}
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
                    Password management is handled through your authentication provider.
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
