import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Trophy } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/hooks/useOrganization";
import { useToast } from "@/hooks/use-toast";

interface IncentiveType {
  id: string;
  name: string;
  description: string | null;
  defaultPoints: number;
  isActive: boolean;
}

export const BountyTypesManagement: React.FC = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<IncentiveType | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    defaultPoints: 10,
    isActive: true
  });

  const { organization } = useOrganization();
  const { toast } = useToast();

  const utils = trpc.useUtils();
  const { data: incentiveTypesRaw, isLoading: loading } = trpc.incentives.listTypes.useQuery();
  const incentiveTypes: IncentiveType[] = (incentiveTypesRaw || []) as IncentiveType[];

  const createType = trpc.incentives.createType.useMutation({
    onSuccess: () => {
      utils.incentives.listTypes.invalidate();
      toast({ title: "Success", description: "Incentive type created" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create incentive type", variant: "destructive" });
    },
  });

  // TODO: No incentives.updateType or incentives.deleteType tRPC routes available yet

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id) return;

    if (editingType) {
      // TODO: Add incentives.updateType tRPC route
      toast({ title: "Not available", description: "Bounty type editing is coming soon", variant: "destructive" });
      return;
    }

    createType.mutate({
      name: formData.name,
      description: formData.description || undefined,
      defaultPoints: formData.defaultPoints,
    });
  };

  const handleEdit = (incentiveType: IncentiveType) => {
    setEditingType(incentiveType);
    setFormData({
      name: incentiveType.name,
      description: incentiveType.description || '',
      defaultPoints: incentiveType.defaultPoints,
      isActive: incentiveType.isActive
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    // TODO: Add incentives.deleteType tRPC route
    toast({ title: "Not available", description: "Bounty type deletion is coming soon", variant: "destructive" });
  };

  const resetForm = () => {
    setEditingType(null);
    setFormData({ name: '', description: '', defaultPoints: 10, isActive: true });
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
          <h3 className="text-lg font-medium">Incentive Types</h3>
          <p className="text-sm text-muted-foreground">
            Configure the types of incentives employees can submit for recognition
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); else setDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Incentive Type
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingType ? 'Edit Incentive Type' : 'Add Incentive Type'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Five-Star Review"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe what qualifies for this incentive"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="points">Default Points</Label>
                <Input
                  id="points"
                  type="number"
                  min="1"
                  value={formData.defaultPoints}
                  onChange={(e) => setFormData({ ...formData, defaultPoints: parseInt(e.target.value) || 10 })}
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

      {incentiveTypes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Trophy className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No incentive types configured yet</p>
            <p className="text-sm text-muted-foreground">Add incentive types to enable employee recognition</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Points</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {incentiveTypes.map((type) => (
                <TableRow key={type.id}>
                  <TableCell className="font-medium">{type.name}</TableCell>
                  <TableCell className="text-muted-foreground">{type.description || '-'}</TableCell>
                  <TableCell>{type.defaultPoints}</TableCell>
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
