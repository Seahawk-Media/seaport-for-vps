import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Briefcase, Edit, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";

interface PositionRole {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
}

export const PositionManagement: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingPosition, setEditingPosition] = useState<PositionRole | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: ''
  });
  const { toast } = useToast();

  const utils = trpc.useUtils();
  const { data: positionsRaw, isLoading: loading } = trpc.positions.listRoles.useQuery();
  const positions: PositionRole[] = (positionsRaw || []) as PositionRole[];

  const createPosition = trpc.positions.createRole.useMutation({
    onSuccess: () => {
      utils.positions.listRoles.invalidate();
      toast({ title: "Success", description: "Position created successfully" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save position", variant: "destructive" });
    },
  });

  // Note: No update/delete routes provided for positions, keeping UI but logging warning
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingPosition) {
      // TODO: Add positions.updateRole tRPC route
      toast({ title: "Not available", description: "Position editing is coming soon", variant: "destructive" });
      return;
    }

    createPosition.mutate({
      title: formData.title,
      description: formData.description || undefined,
    });
  };

  const handleEdit = (position: PositionRole) => {
    setEditingPosition(position);
    setFormData({
      title: position.title,
      description: position.description || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (positionId: string) => {
    if (!confirm('Are you sure you want to delete this position?')) return;
    // TODO: Add positions.deleteRole tRPC route
    toast({ title: "Not available", description: "Position deletion is coming soon", variant: "destructive" });
  };

  const resetForm = () => {
    setFormData({ title: '', description: '' });
    setShowForm(false);
    setEditingPosition(null);
  };

  if (loading && positions.length === 0) {
    return <div>Loading positions...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Position Management</h3>
          <p className="text-sm text-muted-foreground">
            Create and manage job titles and positions
          </p>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Position
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingPosition ? 'Edit Position' : 'Create New Position'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="title">Position Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter position title (e.g., CEO, Senior Developer)"
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter position description and responsibilities"
                />
              </div>


              <div className="flex gap-2">
                <Button type="submit" disabled={createPosition.isPending}>
                  {editingPosition ? 'Update' : 'Create'} Position
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {positions.map((position) => (
          <Card key={position.id}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <Briefcase className="h-5 w-5 text-primary" />
                  <div>
                    <h4 className="font-semibold">{position.title}</h4>
                    {position.description && (
                      <p className="text-sm text-muted-foreground">{position.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(position)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(position.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
