import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Calendar } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/hooks/useOrganization";
import { useToast } from "@/hooks/use-toast";

interface TimeOffType {
  id: string;
  name: string;
  description: string | null;
  defaultDaysPerYear: number | null;
  isActive: boolean;
}

export const TimeOffTypesManagement: React.FC = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<TimeOffType | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    defaultDaysPerYear: 0,
    isActive: true
  });

  const { organization } = useOrganization();
  const { toast } = useToast();

  const utils = trpc.useUtils();
  const { data: timeOffTypesRaw, isLoading: loading } = trpc.timeOff.listTypes.useQuery();
  const timeOffTypes: TimeOffType[] = (timeOffTypesRaw || []) as TimeOffType[];

  const createType = trpc.timeOff.createType.useMutation({
    onSuccess: () => {
      utils.timeOff.listTypes.invalidate();
      toast({ title: "Success", description: "Time off type created" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create time off type", variant: "destructive" });
    },
  });

  // TODO: No timeOff.updateType or timeOff.deleteType tRPC routes available yet

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id) return;

    if (editingType) {
      // TODO: Add timeOff.updateType tRPC route
      toast({ title: "Not available", description: "Time off type editing is coming soon", variant: "destructive" });
      return;
    }

    createType.mutate({
      name: formData.name,
      description: formData.description || undefined,
      defaultDaysPerYear: formData.defaultDaysPerYear,
    });
  };

  const handleEdit = (timeOffType: TimeOffType) => {
    setEditingType(timeOffType);
    setFormData({
      name: timeOffType.name,
      description: timeOffType.description || '',
      defaultDaysPerYear: timeOffType.defaultDaysPerYear || 0,
      isActive: timeOffType.isActive
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    // TODO: Add timeOff.deleteType tRPC route
    toast({ title: "Not available", description: "Time off type deletion is coming soon", variant: "destructive" });
  };

  const resetForm = () => {
    setEditingType(null);
    setFormData({ name: '', description: '', defaultDaysPerYear: 0, isActive: true });
    setDialogOpen(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Time Off Types</h3>
          <p className="text-sm text-muted-foreground">
            Configure the types of time off available for employees to request
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); else setDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Time Off Type
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingType ? 'Edit Time Off Type' : 'Add Time Off Type'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Vacation, Sick Leave"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe this time off type"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="days">Default Days Per Year</Label>
                <Input
                  id="days"
                  type="number"
                  min="0"
                  step="0.5"
                  value={formData.defaultDaysPerYear}
                  onChange={(e) => setFormData({ ...formData, defaultDaysPerYear: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="active">Active</Label>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                <Button type="submit">{editingType ? 'Update' : 'Create'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {timeOffTypes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No time off types configured yet</p>
            <p className="text-sm text-muted-foreground">Add time off types to enable leave requests</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Days/Year</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {timeOffTypes.map((type) => (
                <TableRow key={type.id}>
                  <TableCell className="font-medium">{type.name}</TableCell>
                  <TableCell className="text-muted-foreground">{type.description || '-'}</TableCell>
                  <TableCell>{type.defaultDaysPerYear || '-'}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      type.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {type.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(type)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(type.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
};
