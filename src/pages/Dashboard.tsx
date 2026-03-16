import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';
import { useRole } from '@/hooks/useRole';
import { OrganizationSetup } from '@/components/org/OrganizationSetup';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DepartmentWorkspace } from '@/components/department/DepartmentWorkspace';
import { Spinner } from '@/components/ui/spinner';
import { Building2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

interface Department {
  id: string;
  name: string;
}

const Dashboard = () => {
  const { user, loading } = useAuth();
  const { organization, loading: orgLoading, refetch: refetchOrganization } = useOrganization();
  const { isSuperAdmin, isAdmin, loading: roleLoading } = useRole();
  const navigate = useNavigate();

  const [activeDeptIndex, setActiveDeptIndex] = useState(0);

  // Auth guard
  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [user, loading, navigate]);

  const canSeeAll = !roleLoading && (isSuperAdmin() || isAdmin());

  // Load departments via tRPC
  const { data: allDepartments, isLoading: loadingAllDepts } = trpc.departments.list.useQuery(undefined, {
    enabled: !!organization?.id && !roleLoading && canSeeAll,
  });

  // Load current user's profile for non-admin users
  const { data: myProfile, isLoading: loadingMyProfile } = trpc.profiles.me.useQuery(undefined, {
    enabled: !!organization?.id && !roleLoading && !canSeeAll,
  });

  // For non-admin: get their department
  const { data: myDepartment, isLoading: loadingMyDept } = trpc.departments.get.useQuery(
    { id: myProfile?.departmentId ?? '' },
    { enabled: !!myProfile?.departmentId && !canSeeAll },
  );

  const loadingDepts = canSeeAll ? loadingAllDepts : (loadingMyProfile || loadingMyDept);

  const departments: Department[] = canSeeAll
    ? (allDepartments ?? []).map(d => ({ id: d.id, name: d.name }))
    : myDepartment
      ? [{ id: myDepartment.id, name: myDepartment.name }]
      : [];

  // ── Loading / org setup ────────────────────────────────────────────────────

  if (loading || orgLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Spinner size="lg" className="mx-auto mb-4" />
          <p className="text-muted-foreground">Loading {import.meta.env.VITE_APP_NAME || 'Seaport'}...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;
  if (!organization) return <OrganizationSetup onComplete={refetchOrganization} />;

  const activeDept = departments[activeDeptIndex] ?? null;
  const multiDept = departments.length > 1;

  const prev = () => setActiveDeptIndex(i => Math.max(0, i - 1));
  const next = () => setActiveDeptIndex(i => Math.min(departments.length - 1, i + 1));

  // Build header: dept name with prev/next flipbook arrows (if multiple)
  const headerContent = loadingDepts || roleLoading ? undefined : (
    <div className="flex items-center gap-3">
      <div className="rounded-md bg-primary/10 p-1.5">
        <Building2 className="h-4 w-4 text-primary" />
      </div>

      {multiDept && (
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prev} disabled={activeDeptIndex === 0}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}

      <div>
        <h1 className="text-base font-semibold leading-tight">
          {activeDept?.name ?? 'Dashboard'}
        </h1>
        {multiDept && (
          <p className="text-xs text-muted-foreground">
            {activeDeptIndex + 1} of {departments.length} departments
          </p>
        )}
      </div>

      {multiDept && (
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={next} disabled={activeDeptIndex === departments.length - 1}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}

      {/* Dot indicators */}
      {multiDept && (
        <div className="flex items-center gap-1 ml-1">
          {departments.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveDeptIndex(i)}
              className={cn(
                'rounded-full transition-all duration-150',
                i === activeDeptIndex
                  ? 'w-4 h-1.5 bg-primary'
                  : 'w-1.5 h-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50',
              )}
            />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <DashboardLayout headerContent={headerContent} title={loadingDepts ? 'Dashboard' : undefined}>
      {loadingDepts || roleLoading ? (
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      ) : departments.length === 0 || !activeDept ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
          <Building2 className="h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">You haven't been assigned to a department yet.</p>
        </div>
      ) : (
        <DepartmentWorkspace
          key={activeDept.id}
          departmentId={activeDept.id}
        />
      )}
    </DashboardLayout>
  );
};

export default Dashboard;
