import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Building2, Crown } from "lucide-react";
import { trpc } from '@/lib/trpc';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DepartmentWorkspace } from "@/components/department/DepartmentWorkspace";
import { Spinner } from "@/components/ui/spinner";

const getInitials = (name: string) =>
  name?.split(' ').map(n => n[0]).join('').toUpperCase() || '??';

const DepartmentPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const { loading: orgLoading } = useOrganization();

  React.useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  const { data: department, isLoading: deptLoading } = trpc.departments.get.useQuery(
    { id: id! },
    { enabled: !!id }
  );

  const { data: departmentHead } = trpc.profiles.get.useQuery(
    { id: department?.headId! },
    { enabled: !!department?.headId }
  );

  const { data: allProfiles } = trpc.profiles.list.useQuery();
  const memberCount = allProfiles?.filter((p: any) => p.departmentId === id).length ?? 0;

  const loading = deptLoading;

  if (authLoading || orgLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!department) {
    return (
      <DashboardLayout viewMode="departments" title="Department Not Found">
        <div className="flex flex-col items-center justify-center h-full gap-4 py-12">
          <p className="text-muted-foreground">Department not found</p>
          <Button variant="outline" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-2" />Go Back
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const headerContent = (
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/dashboard')}>
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <div className="rounded-md bg-primary/10 p-1.5">
        <Building2 className="h-4 w-4 text-primary" />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold leading-tight">{department.name}</h1>
          <Badge variant="secondary" className="text-xs">{memberCount} members</Badge>
          {departmentHead && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Avatar className="h-4 w-4">
                <AvatarImage src={departmentHead.avatarUrl || ''} />
                <AvatarFallback className="text-[10px]">{getInitials(departmentHead.fullName || '')}</AvatarFallback>
              </Avatar>
              <span>{departmentHead.fullName}</span>
              <Crown className="h-3 w-3 text-primary" />
            </div>
          )}
        </div>
        {department.description && (
          <p className="text-xs text-muted-foreground leading-tight">{department.description}</p>
        )}
      </div>
    </div>
  );

  return (
    <DashboardLayout viewMode="departments" headerContent={headerContent}>
      <DepartmentWorkspace departmentId={id!} />
    </DashboardLayout>
  );
};

export default DepartmentPage;
