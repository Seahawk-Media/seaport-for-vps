import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { Eye, EyeOff } from 'lucide-react';

type AppRole = Database['public']['Enums']['app_role'];

interface CreateUserProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  organizationId: string;
}

export const CreateUser = ({ open, onOpenChange, onCreated, organizationId }: CreateUserProps) => {
  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    password: '',
    role: 'employee' as AppRole,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password.length < 6) {
      toast({ title: "Password too short", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    setLoading(true);

    try {
      let resolvedOrganizationId = organizationId;

      if (!resolvedOrganizationId) {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          throw new Error('You must be logged in to create users');
        }

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('user_id', user.id)
          .single();

        if (profileError) {
          throw new Error(profileError.message);
        }

        if (!profileData?.organization_id) {
          throw new Error('Could not resolve organization for current user');
        }

        resolvedOrganizationId = profileData.organization_id;
      }

      const { error } = await supabase.functions.invoke('create-user', {
        body: {
          email: formData.email,
          password: formData.password,
          fullName: formData.fullName,
          role: formData.role,
          organizationId: resolvedOrganizationId,
        },
      });

      if (error) {
        let message = error.message;
        const context = (error as { context?: Response }).context;

        if (context instanceof Response) {
          try {
            const errorBody = await context.json();
            if (errorBody?.error) {
              message = errorBody.error;
            }
          } catch {
            // Ignore parse errors and use default message
          }
        }

        throw new Error(message);
      }

      toast({
        title: "User created",
        description: `${formData.fullName} (${formData.email}) has been added. They can log in immediately with the provided password.`,
      });

      setFormData({ email: '', fullName: '', password: '', role: 'employee' });
      onCreated();
      onOpenChange(false);
    } catch (error: any) {
      const msg = error.message || '';
      const isDuplicate = /already registered|already been registered|already exists/i.test(msg);
      toast({
        title: isDuplicate ? "Email already registered" : "Error creating user",
        description: isDuplicate
          ? "This email is already registered. Use the existing user or delete them first from the user list."
          : msg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create User</DialogTitle>
          <DialogDescription>
            Manually create a user account. They can log in immediately.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                required
                disabled={loading}
                placeholder="Jane Smith"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="createEmail">Email Address</Label>
              <Input
                id="createEmail"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                required
                disabled={loading}
                placeholder="jane@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Temporary Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  required
                  disabled={loading}
                  placeholder="Min. 6 characters"
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-3 flex items-center text-muted-foreground"
                  onClick={() => setShowPassword(v => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="createRole">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value: AppRole) => setFormData(prev => ({ ...prev, role: value }))}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
