import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useToast } from "@/hooks/use-toast";

interface TimeOffType {
  id: string;
  name: string;
  description: string | null;
  default_days_per_year: number | null;
  is_active: boolean;
}

export const TimeOffTypesManagement: React.FC = () => {
  const [timeOffTypes, setTimeOffTypes] = useState<TimeOffType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<TimeOffType | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    default_days_per_year: 0,
    is_active: true
  });
  
  const { organization } = useOrganization();
  const { toast } = useToast();

  useEffect(() => {
    if (organization?.id) {
      fetchTimeOffTypes();
    }
  }, [organization?.id]);

  const fetchTimeOffTypes = async () => {
    if (!organization?.id) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('time_off_types')
      .select('*')
      .eq('organization_id', organization.id)
      .order('name');

    if (error) {
      console.error('Error fetching time off types:', error);
      toast({ title: "Error", description: "Failed to load time off types", variant: "destructive" });
    } else {
      setTimeOffTypes(data || []);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id) return;

    if (editingType) {
      const { error } = await supabase
        .from('time_off_types')
        .update({
          name: formData.name,
          description: formData.description || null,
          default_days_per_year: formData.default_days_per_year,
          is_active: formData.is_active
        })
        .eq('id', editingType.id);

      if (error) {
        toast({ title: "Error", description: "Failed to update time off type", variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Time off type updated" });
        fetchTimeOffTypes();
        resetForm();
      }
    } else {
      const { error } = await supabase
        .from('time_off_types')
        .insert({
          organization_id: organization.id,
          name: formData.name,
          description: formData.description || null,
          default_days_per_year: formData.default_days_per_year,
          is_active: formData.is_active
        });

      if (error) {
        toast({ title: "Error", description: "Failed to create time off type", variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Time off type created" });
        fetchTimeOffTypes();
        resetForm();
      }
    }
  };

  const handleEdit = (timeOffType: TimeOffType) => {
    setEditingType(timeOffType);
    setFormData({
      name: timeOffType.name,
      description: timeOffType.description || '',
      default_days_per_year: timeOffType.default_days_per_year || 0,
      is_active: timeOffType.is_active
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('time_off_types')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: "Error", description: "Failed to delete time off type", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Time off type deleted" });
      fetchTimeOffTypes();
    }
  };

  const resetForm = () => {
    setEditingType(null);
    setFormData({ name: '', description: '', default_days_per_year: 0, is_active: true });
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
                  value={formData.default_days_per_year}
                  onChange={(e) => setFormData({ ...formData, default_days_per_year: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
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
                  <TableCell>{type.default_days_per_year || '-'}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      type.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {type.is_active ? 'Active' : 'Inactive'}
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
