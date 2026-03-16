import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { trpc } from '@/lib/trpc';
import { Copy, Check } from 'lucide-react';

type AppRole = 'admin' | 'manager' | 'employee';

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
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const inviteMutation = trpc.invitations.create.useMutation({
    onSuccess: (data) => {
      if (data.inviteUrl) {
        setInviteLink(data.inviteUrl);
      }
      toast({ title: `Invitation created for ${formData.email}` });
      onInviteSent();
      setFormData({ email: '', role: 'employee' });
      if (!data.inviteUrl) {
        onOpenChange(false);
      }
    },
    onError: (error) => {
      toast({
        title: "Error sending invitation",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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
    inviteMutation.mutate({
      email: formData.email,
      role: formData.role,
    });
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
                  disabled={inviteMutation.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value: AppRole) => setFormData(prev => ({ ...prev, role: value }))}
                  disabled={inviteMutation.isPending}
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
              <Button type="submit" disabled={inviteMutation.isPending}>
                {inviteMutation.isPending ? "Sending..." : "Send Invitation"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
