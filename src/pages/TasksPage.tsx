import React, { useState, useEffect } from 'react';
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { TasksTab } from "@/components/workspace/tabs/TasksTab";
import { MyTasksView } from "@/components/tasks/MyTasksView";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { useOrganization } from "@/hooks/useOrganization";
import { Building2, User } from "lucide-react";

interface Department {
  id: string;
  name: string;
}

type ViewFilter = 'all' | 'mine';

const TasksPage = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ViewFilter>('all');
  const { user } = useAuth();
  const { isAdmin, isSuperAdmin, isManager } = useRole();
  const { organization } = useOrganization();

  const isElevated = isAdmin() || isSuperAdmin() || isManager();

  useEffect(() => {
    if (organization) fetchDepartments();
  }, [organization, user]);

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      if (isElevated) {
        const { data } = await supabase
          .from('departments')
          .select('id, name')
          .eq('organization_id', organization!.id)
          .order('name');
        setDepartments(data || []);
      } else {
        const { data: profile } = await supabase
          .from('profiles')
          .select('department_id, department:departments(id, name)')
          .eq('user_id', user!.id)
          .single();

        if (profile?.department_id && profile.department) {
          const dept = profile.department as unknown as Department;
          setDepartments([{ id: dept.id, name: dept.name }]);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout
      title="Tasks"
      description={filter === 'mine' ? 'Tasks assigned to you' : isElevated ? 'All department task boards' : 'Your department task board'}
    >
      <div className="space-y-6 max-w-7xl mx-auto">

        {/* Filter toggle */}
        <div className="flex items-center gap-1 border border-border rounded-lg p-1 w-fit bg-muted/30">
          <button
            onClick={() => setFilter('all')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            All Tasks
          </button>
          <button
            onClick={() => setFilter('mine')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === 'mine'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <User className="h-3.5 w-3.5" />
            My Tasks
          </button>
        </div>

        {filter === 'mine' ? (
          <MyTasksView />
        ) : loading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            Loading departments...
          </div>
        ) : departments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border rounded-lg">
            <Building2 className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No departments found</p>
            <p className="text-xs text-muted-foreground/60 mt-1">You need to be assigned to a department to see tasks</p>
          </div>
        ) : (
          <div className="space-y-10">
            {departments.map((dept) => (
              <section key={dept.id}>
                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-base font-semibold">{dept.name}</h2>
                </div>
                <TasksTab
                  departmentId={dept.id}
                  departmentName={dept.name}
                />
              </section>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default TasksPage;
