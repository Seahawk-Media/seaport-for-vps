import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

const ICON_OPTIONS = [
  'FileText', 'UserPlus', 'TrendingUp', 'ArrowRightLeft', 'GraduationCap',
  'Award', 'Trophy', 'Users', 'MessageSquare', 'Flag', 'Calendar',
  'Star', 'Heart', 'Briefcase', 'Zap', 'Target', 'BookOpen',
];

const COLOR_OPTIONS = [
  { value: 'gray', label: 'Gray', class: 'bg-gray-100 text-gray-800' },
  { value: 'green', label: 'Green', class: 'bg-green-100 text-green-800' },
  { value: 'blue', label: 'Blue', class: 'bg-blue-100 text-blue-800' },
  { value: 'purple', label: 'Purple', class: 'bg-purple-100 text-purple-800' },
  { value: 'yellow', label: 'Yellow', class: 'bg-yellow-100 text-yellow-800' },
  { value: 'orange', label: 'Orange', class: 'bg-orange-100 text-orange-800' },
  { value: 'red', label: 'Red', class: 'bg-red-100 text-red-800' },
  { value: 'pink', label: 'Pink', class: 'bg-pink-100 text-pink-800' },
  { value: 'indigo', label: 'Indigo', class: 'bg-indigo-100 text-indigo-800' },
  { value: 'teal', label: 'Teal', class: 'bg-teal-100 text-teal-800' },
  { value: 'amber', label: 'Amber', class: 'bg-amber-100 text-amber-800' },
  { value: 'slate', label: 'Slate', class: 'bg-slate-100 text-slate-800' },
];

export function JourneyEventTypesManagement() {
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', slug: '', description: '', icon: 'FileText', color: 'gray' });

  const { data: eventTypes = [], isLoading, refetch } = trpc.journeyEventTypes.list.useQuery();

  const createMutation = trpc.journeyEventTypes.create.useMutation({
    onSuccess: () => { toast({ title: 'Event type created' }); refetch(); handleCloseModal(); },
    onError: (err) => { toast({ title: 'Error', description: err.message, variant: 'destructive' }); },
  });

  const updateMutation = trpc.journeyEventTypes.update.useMutation({
    onSuccess: () => { toast({ title: 'Event type updated' }); refetch(); handleCloseModal(); },
    onError: (err) => { toast({ title: 'Error', description: err.message, variant: 'destructive' }); },
  });

  const deleteMutation = trpc.journeyEventTypes.delete.useMutation({
    onSuccess: () => { toast({ title: 'Event type deleted' }); refetch(); },
    onError: (err) => { toast({ title: 'Error', description: err.message, variant: 'destructive' }); },
  });

  const toggleMutation = trpc.journeyEventTypes.update.useMutation({
    onSuccess: () => refetch(),
  });

  const handleOpenCreate = () => {
    setEditingType(null);
    setFormData({ name: '', slug: '', description: '', icon: 'FileText', color: 'gray' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (type: any) => {
    setEditingType(type);
    setFormData({
      name: type.name,
      slug: type.slug,
      description: type.description || '',
      icon: type.icon || 'FileText',
      color: type.color || 'gray',
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingType(null);
    setFormData({ name: '', slug: '', description: '', icon: 'FileText', color: 'gray' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingType) {
      updateMutation.mutate({ id: editingType.id, ...formData });
    } else {
      const slug = formData.slug || formData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      createMutation.mutate({ ...formData, slug, sortOrder: eventTypes.length });
    }
  };

  const handleToggleActive = (id: string, currentlyActive: boolean) => {
    toggleMutation.mutate({ id, isActive: !currentlyActive });
  };

  const getColorClass = (color: string) => {
    return COLOR_OPTIONS.find((c) => c.value === color)?.class || 'bg-gray-100 text-gray-800';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Journey Event Types</h3>
          <p className="text-sm text-muted-foreground">
            Customize the types of events employees can log on their timeline.
          </p>
        </div>
        <Button onClick={handleOpenCreate} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Event Type
        </Button>
      </div>

      <div className="space-y-2">
        {eventTypes.map((type: any) => (
          <Card key={type.id} className={!type.isActive ? 'opacity-50' : ''}>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <Badge className={`${getColorClass(type.color)} border-0 px-3 py-1`}>
                  {type.name}
                </Badge>
                <span className="text-sm text-muted-foreground flex-1">
                  {type.description || type.slug}
                </span>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`toggle-${type.id}`} className="text-xs text-muted-foreground">
                      {type.isActive ? 'Active' : 'Inactive'}
                    </Label>
                    <Switch
                      id={`toggle-${type.id}`}
                      checked={type.isActive}
                      onCheckedChange={() => handleToggleActive(type.id, type.isActive)}
                    />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(type)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {!type.isDefault && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate({ id: type.id })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {eventTypes.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-muted-foreground">No event types configured. Click "Add Event Type" to create one.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={handleCloseModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingType ? 'Edit Event Type' : 'Add Event Type'}</DialogTitle>
            <DialogDescription>
              {editingType ? 'Update this journey event type.' : 'Create a new type of journey event that employees can log.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setFormData((prev) => ({
                    ...prev,
                    name,
                    slug: editingType ? prev.slug : name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
                  }));
                }}
                placeholder="e.g., Certification"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="A brief description of this event type"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Icon</Label>
                <Select value={formData.icon} onValueChange={(v) => setFormData((prev) => ({ ...prev, icon: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map((icon) => (
                      <SelectItem key={icon} value={icon}>
                        {icon}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Color</Label>
                <Select value={formData.color} onValueChange={(v) => setFormData((prev) => ({ ...prev, color: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLOR_OPTIONS.map((color) => (
                      <SelectItem key={color.value} value={color.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${color.class.split(' ')[0]}`} />
                          {color.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseModal}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending || !formData.name}>
                {(createMutation.isPending || updateMutation.isPending) ? 'Saving...' : editingType ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
