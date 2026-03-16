import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Building2, Crown, Users, UserPlus, Edit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/useRole";

interface DepartmentDashboardProps {
  departmentId: string;
  onBack: () => void;
  onEmployeeClick?: (employeeId: string) => void;
}

interface Department {
  id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  head_id: string | null;
  organization_id: string;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  job_title: string | null;
  status: string | null;
  location: string | null;
}

export const DepartmentDashboard: React.FC<DepartmentDashboardProps> = ({
  departmentId,
  onBack,
  onEmployeeClick
}) => {
  const [department, setDepartment] = useState<Department | null>(null);
  const [departmentHead, setDepartmentHead] = useState<Profile | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [parentDepartment, setParentDepartment] = useState<{ id: string; name: string } | null>(null);
  const [childDepartments, setChildDepartments] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { isAdmin, isSuperAdmin } = useRole();

  useEffect(() => {
    fetchDepartmentData();
  }, [departmentId]);

  const fetchDepartmentData = async () => {
    try {
      // Fetch department
      const { data: deptData, error: deptError } = await supabase
        .from('departments')
        .select('*')
        .eq('id', departmentId)
        .single();

      if (deptError) throw deptError;
      setDepartment(deptData);

      // Fetch department head if exists
      if (deptData.head_id) {
        const { data: headData } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url, job_title, status, location')
          .eq('id', deptData.head_id)
          .single();
        setDepartmentHead(headData);
      }

      // Fetch parent department if exists
      if (deptData.parent_id) {
        const { data: parentData } = await supabase
          .from('departments')
          .select('id, name')
          .eq('id', deptData.parent_id)
          .single();
        setParentDepartment(parentData);
      }

      // Fetch child departments
      const { data: childData } = await supabase
        .from('departments')
        .select('id, name')
        .eq('parent_id', departmentId);
      setChildDepartments(childData || []);

      // Fetch members
      const { data: membersData, error: membersError } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, job_title, status, location')
        .eq('department_id', departmentId)
        .order('full_name');

      if (membersError) throw membersError;
      setMembers(membersData || []);

    } catch (error) {
      console.error('Error fetching department data:', error);
      toast({
        title: "Error",
        description: "Failed to load department data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || '??';
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'inactive': return 'bg-red-500';
      case 'on_leave': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-muted-foreground">Loading department...</div>
      </div>
    );
  }

  if (!department) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="text-lg text-muted-foreground">Department not found</div>
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary p-3">
              <Building2 className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{department.name}</h1>
              {parentDepartment && (
                <p className="text-sm text-muted-foreground">
                  Part of: {parentDepartment.name}
                </p>
              )}
            </div>
          </div>
        </div>
        {(isAdmin() || isSuperAdmin()) && (
          <Button variant="outline">
            <Edit className="h-4 w-4 mr-2" />
            Edit Department
          </Button>
        )}
      </div>

      {/* Description */}
      {department.description && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">{department.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{members.length}</p>
                <p className="text-sm text-muted-foreground">Team Members</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Building2 className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{childDepartments.length}</p>
                <p className="text-sm text-muted-foreground">Sub-departments</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {departmentHead && (
          <Card 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onEmployeeClick?.(departmentHead.id)}
          >
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={departmentHead.avatar_url || ''} />
                    <AvatarFallback>{getInitials(departmentHead.full_name)}</AvatarFallback>
                  </Avatar>
                  <Crown className="absolute -top-1 -right-1 h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="font-semibold">{departmentHead.full_name}</p>
                  <p className="text-sm text-muted-foreground">Department Head</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Child Departments */}
      {childDepartments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Sub-departments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {childDepartments.map(child => (
                <Badge key={child.id} variant="secondary" className="text-sm py-1 px-3">
                  {child.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team Members */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Members
            </CardTitle>
            {(isAdmin() || isSuperAdmin()) && (
              <Button size="sm">
                <UserPlus className="h-4 w-4 mr-2" />
                Add Member
              </Button>
            )}
          </div>
          <CardDescription>
            {members.length} members in this department
          </CardDescription>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No members assigned to this department yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {members.map(member => (
                <Card 
                  key={member.id} 
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => onEmployeeClick?.(member.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={member.avatar_url || ''} />
                          <AvatarFallback>{getInitials(member.full_name)}</AvatarFallback>
                        </Avatar>
                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${getStatusColor(member.status)}`} />
                        {departmentHead?.id === member.id && (
                          <Crown className="absolute -top-1 -right-1 h-4 w-4 text-yellow-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <h4 className="font-semibold text-sm truncate">{member.full_name}</h4>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                        {member.job_title && (
                          <Badge variant="outline" className="text-xs mt-1">
                            {member.job_title}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
