import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { X } from 'lucide-react';

interface IncentiveSubmissionFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function IncentiveSubmissionForm({ onClose, onSuccess }: IncentiveSubmissionFormProps) {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const { toast } = useToast();
  const [incentiveTypeId, setIncentiveTypeId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');

  const { data: incentiveTypes = [] } = trpc.incentives.listTypes.useQuery(
    undefined,
    { enabled: !!organization }
  );

  // Set default type when types load
  const activeTypes = (incentiveTypes as Array<{ id: string; name: string; defaultPoints: number; isActive?: boolean }>).filter((t) => t.isActive !== false);

  const selectedType = activeTypes.find((t) => t.id === incentiveTypeId);

  // Auto-select first type if none selected
  if (!incentiveTypeId && activeTypes.length > 0) {
    setIncentiveTypeId(activeTypes[0].id);
  }

  const createIncentive = trpc.incentives.create.useMutation({
    onSuccess: () => {
      toast({ title: 'Incentive submitted', description: 'Your achievement has been submitted for review.' });
      onSuccess();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to submit incentive.', variant: 'destructive' });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !organization || !selectedType) return;

    if (!title.trim()) {
      toast({ title: 'Title required', description: 'Please enter a title for your incentive.', variant: 'destructive' });
      return;
    }

    createIncentive.mutate({
      title: title.trim(),
      description: description || undefined,
      incentiveType: selectedType.name,
      evidenceUrl: evidenceUrl || undefined,
      points: selectedType.defaultPoints,
    });
  };

  if (activeTypes.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Submit Achievement</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No incentive types configured yet. Ask an admin to create incentive types in Org Settings.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Submit Achievement</CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="type">Achievement Type</Label>
            <Select value={incentiveTypeId} onValueChange={setIncentiveTypeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {activeTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name} ({type.defaultPoints} pts)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Google review from John D."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="evidence">Evidence URL (optional)</Label>
            <Input
              id="evidence"
              type="url"
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional details..."
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createIncentive.isPending}>
              {createIncentive.isPending ? 'Submitting...' : 'Submit'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
