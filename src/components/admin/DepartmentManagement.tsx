import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Building2, Edit, Trash2, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Department {
  id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  head_id: string | null;
  organization_id: string;
  created_at: string;
  updated_at?: string;
  parent_department?: {
    name: string;
  } | null;
  department_head?: {
    id: string;
    full_name: string;
    email: string;
  } | null;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
}

export const DepartmentManagement: React.FC = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    parent_id: '',
    head_id: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchDepartments();
    fetchProfiles();
  }, []);

  const fetchDepartments = async () => {
    try {
      // Fetch departments with head info only (skip self-reference join)
      const { data, error } = await supabase
        .from('departments')
        .select(`
          *,
          department_head:profiles!departments_head_id_fkey(id, full_name, email)
        `)
        .order('name');

      if (error) throw error;
      
      // Manually resolve parent department names
      const deptMap = new Map((data || []).map(d => [d.id, d.name]));
      
      const transformedData = (data || []).map(dept => ({
        ...dept,
        parent_department: dept.parent_id ? { name: deptMap.get(dept.parent_id) || 'Unknown' } : null
      }));
      
      setDepartments(transformedData);
    } catch (error) {
      console.error('Error fetching departments:', error);
      toast({
        title: "Error",
        description: "Failed to fetch departments",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name');

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error fetching profiles:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Get user's organization
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();
      
      if (!profile?.organization_id) throw new Error('No organization found');

      const departmentData = {
        name: formData.name,
        description: formData.description || null,
        parent_id: formData.parent_id === 'none' ? null : formData.parent_id || null,
        head_id: formData.head_id === 'none' ? null : formData.head_id || null,
        organization_id: profile.organization_id
      };

      if (editingDepartment) {
        const { error } = await supabase
          .from('departments')
          .update(departmentData)
          .eq('id', editingDepartment.id);

        if (error) throw error;
        toast({
          title: "Success",
          description: "Department updated successfully"
        });
      } else {
        const { error } = await supabase
          .from('departments')
          .insert([departmentData]);

        if (error) throw error;
        toast({
          title: "Success",
          description: "Department created successfully"
        });
      }

      setFormData({ name: '', description: '', parent_id: '', head_id: '' });
      setShowForm(false);
      setEditingDepartment(null);
      fetchDepartments();
    } catch (error) {
      console.error('Error saving department:', error);
      toast({
        title: "Error",
        description: "Failed to save department",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (department: Department) => {
    setEditingDepartment(department);
    setFormData({
      name: department.name,
      description: department.description || '',
      parent_id: department.parent_id || '',
      head_id: department.head_id || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (departmentId: string) => {
    if (!confirm('Are you sure you want to delete this department?')) return;

    try {
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', departmentId);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Department deleted successfully"
      });
      fetchDepartments();
    } catch (error) {
      console.error('Error deleting department:', error);
      toast({
        title: "Error",
        description: "Failed to delete department",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', parent_id: '', head_id: '' });
    setShowForm(false);
    setEditingDepartment(null);
  };

  const parentDepartments = departments.filter(dept => !dept.parent_id);

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
                  value={formData.parent_id} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, parent_id: value }))}
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
                <Label htmlFor="head_id">Department Head (Optional)</Label>
                <Select 
                  value={formData.head_id} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, head_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department head" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Department Head</SelectItem>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
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
                      {department.department_head && (
                        <Crown className="h-4 w-4 text-yellow-500" />
                      )}
                    </div>
                    {department.description && (
                      <p className="text-sm text-muted-foreground">{department.description}</p>
                    )}
                    {department.parent_department && (
                      <p className="text-xs text-muted-foreground">
                        Sub-department of: {department.parent_department.name}
                      </p>
                    )}
                    {department.department_head && (
                      <p className="text-xs text-muted-foreground">
                        Department Head: {department.department_head.full_name}
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