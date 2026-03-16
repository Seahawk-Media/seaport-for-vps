import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Building2, Edit, Trash2, Crown } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";

interface Department {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  headId: string | null;
  organizationId: string;
  createdAt: string;
  updatedAt?: string;
  parentDepartment?: {
    name: string;
  } | null;
  departmentHead?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
}

interface Profile {
  id: string;
  fullName: string;
  email: string;
}

export const DepartmentManagement: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    parentId: '',
    headId: ''
  });
  const { toast } = useToast();

  const utils = trpc.useUtils();
  const { data: departmentsRaw, isLoading: loading } = trpc.departments.list.useQuery();
  const { data: profilesRaw } = trpc.profiles.list.useQuery();

  // Transform departments to include parent department names
  const departments: Department[] = (departmentsRaw ?? []).map((dept) => {
    const deptMap = new Map((departmentsRaw ?? []).map((d) => [d.id, d.name]));
    return {
      ...dept,
      parentDepartment: dept.parentId ? { name: deptMap.get(dept.parentId) || 'Unknown' } : null,
      departmentHead: (dept as Department).departmentHead || null,
    } as Department;
  });

  const profiles: Profile[] = (profilesRaw ?? []).map((p) => ({
    id: p.id,
    fullName: p.fullName,
    email: p.email,
  }));

  const createDepartment = trpc.departments.create.useMutation({
    onSuccess: () => {
      utils.departments.list.invalidate();
      toast({ title: "Success", description: "Department created successfully" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save department", variant: "destructive" });
    },
  });

  const updateDepartment = trpc.departments.update.useMutation({
    onSuccess: () => {
      utils.departments.list.invalidate();
      toast({ title: "Success", description: "Department updated successfully" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save department", variant: "destructive" });
    },
  });

  const deleteDepartmentMutation = trpc.departments.delete.useMutation({
    onSuccess: () => {
      utils.departments.list.invalidate();
      toast({ title: "Success", description: "Department deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete department", variant: "destructive" });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const departmentData = {
      name: formData.name,
      description: formData.description || undefined,
      parentId: formData.parentId === 'none' ? undefined : formData.parentId || undefined,
    };

    if (editingDepartment) {
      updateDepartment.mutate({
        id: editingDepartment.id,
        name: departmentData.name,
        description: departmentData.description,
      });
    } else {
      createDepartment.mutate(departmentData);
    }
  };

  const handleEdit = (department: Department) => {
    setEditingDepartment(department);
    setFormData({
      name: department.name,
      description: department.description || '',
      parentId: department.parentId || '',
      headId: department.headId || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (departmentId: string) => {
    if (!confirm('Are you sure you want to delete this department?')) return;
    deleteDepartmentMutation.mutate({ id: departmentId });
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', parentId: '', headId: '' });
    setShowForm(false);
    setEditingDepartment(null);
  };

  const parentDepartments = departments.filter(dept => !dept.parentId);

  if (loading && departments.length === 0) {
    return <div>Loading departments...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Department Management</h3>
          <p className="text-sm text-muted-foreground">
            Create and manage departments and sub-departments
          </p>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Department
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingDepartment ? 'Edit Department' : 'Create New Department'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Department Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter department name"
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter department description"
                />
              </div>

              <div>
                <Label htmlFor="parent">Parent Department (Optional)</Label>
                <Select
                  value={formData.parentId}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, parentId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select parent department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Parent (Top Level)</SelectItem>
                    {parentDepartments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="headId">Department Head (Optional)</Label>
                <Select
                  value={formData.headId}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, headId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department head" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Department Head</SelectItem>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={createDepartment.isPending || updateDepartment.isPending}>
                  {editingDepartment ? 'Update' : 'Create'} Department
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
        {departments.map((department) => (
          <Card key={department.id}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-primary" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{department.name}</h4>
                      {department.departmentHead && (
                        <Crown className="h-4 w-4 text-yellow-500" />
                      )}
                    </div>
                    {department.description && (
                      <p className="text-sm text-muted-foreground">{department.description}</p>
                    )}
                    {department.parentDepartment && (
                      <p className="text-xs text-muted-foreground">
                        Sub-department of: {department.parentDepartment.name}
                      </p>
                    )}
                    {department.departmentHead && (
                      <p className="text-xs text-muted-foreground">
                        Department Head: {department.departmentHead.fullName}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(department)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(department.id)}
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
