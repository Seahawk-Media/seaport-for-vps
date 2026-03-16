import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { Copy, Check } from 'lucide-react';

type AppRole = Database['public']['Enums']['app_role'];

interface InviteUserProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInviteSent: () => void;
  organizationId: string;
}

export const InviteUser = ({ open, onOpenChange, onInviteSent, organizationId }: InviteUserProps) => {
  const [formData, setFormData] = useState({
    email: '',
    role: 'employee' as AppRole,
  });
  const [loading, setLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    toast({ title: "Link copied to clipboard!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setInviteLink(null);
      setCopied(false);
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setInviteLink(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "You must be logged in to send invitations", variant: "destructive" });
        setLoading(false);
        return;
      }

      const { data: fnData, error: fnError } = await supabase.functions.invoke('invite-user', {
        body: {
          email: formData.email,
          role: formData.role,
          organizationId,
          invitedBy: user.id,
        },
      });

      if (fnError) {
        console.error('Edge function error:', fnError);
        toast({
          title: "Error sending invitation",
          description: fnError.message || "An unexpected error occurred.",
          variant: "destructive",
        });
      } else if (fnData?.warning) {
        // User already exists — amber warning
        toast({
          title: "User already registered",
          description: fnData.warning,
        });
        onInviteSent();
        setFormData({ email: '', role: 'employee' });
        onOpenChange(false);
      } else if (fnData?.inviteLink) {
        // Success with fallback link
        setInviteLink(fnData.inviteLink);
        toast({ title: `Invitation sent to ${formData.email}` });
        onInviteSent();
        setFormData({ email: '', role: 'employee' });
      } else {
        // Full success
        toast({ title: `Invitation sent to ${formData.email}` });
        onInviteSent();
        setFormData({ email: '', role: 'employee' });
        onOpenChange(false);
      }
    } catch (error: any) {
      toast({
        title: "Error sending invitation",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite User</DialogTitle>
          <DialogDescription>
            Send an email invitation to join your organization
          </DialogDescription>
        </DialogHeader>

        {inviteLink ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Shareable Invite Link</Label>
              <p className="text-sm text-muted-foreground">
                Share this link with the user as a backup:
              </p>
              <div className="flex items-center gap-2">
                <Input value={inviteLink} readOnly className="text-xs" />
                <Button type="button" variant="outline" size="icon" onClick={handleCopy} className="flex-shrink-0">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => handleClose(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
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
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Sending..." : "Send Invitation"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
