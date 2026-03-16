import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';
import { supabase } from '@/integrations/supabase/client';
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

interface IncentiveType {
  id: string;
  name: string;
  default_points: number;
  description: string | null;
}

export function IncentiveSubmissionForm({ onClose, onSuccess }: IncentiveSubmissionFormProps) {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [incentiveTypes, setIncentiveTypes] = useState<IncentiveType[]>([]);
  const [incentiveTypeId, setIncentiveTypeId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');

  useEffect(() => {
    fetchIncentiveTypes();
  }, [organization]);

  const fetchIncentiveTypes = async () => {
    if (!organization) return;

    try {
      const { data, error } = await supabase
        .from('incentive_types')
        .select('id, name, default_points, description')
        .eq('organization_id', organization.id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setIncentiveTypes(data || []);
      if (data && data.length > 0) {
        setIncentiveTypeId(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching incentive types:', error);
    }
  };

  const selectedType = incentiveTypes.find(t => t.id === incentiveTypeId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !organization || !selectedType) return;

    if (!title.trim()) {
      toast({
        title: 'Title required',
        description: 'Please enter a title for your incentive.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) throw new Error('Profile not found');

      const { error } = await (supabase
        .from('incentives' as any)
        .insert({
          profile_id: profile.id,
          organization_id: organization.id,
          incentive_type: selectedType.name,
          title: title.trim(),
          description: description || null,
          evidence_url: evidenceUrl || null,
          points: selectedType.default_points,
          status: 'pending',
        }) as any);

      if (error) throw error;

      toast({
        title: 'Incentive submitted',
        description: 'Your achievement has been submitted for review.',
      });
      onSuccess();
    } catch (error) {
      console.error('Error submitting incentive:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit incentive.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (incentiveTypes.length === 0) {
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
                {incentiveTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name} ({type.default_points} pts)
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
            <Button type="submit" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
