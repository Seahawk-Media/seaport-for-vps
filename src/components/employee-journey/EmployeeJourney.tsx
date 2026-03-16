import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { JourneyView } from './JourneyView';
import { EmployeeSidebar } from './EmployeeSidebar';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  job_title?: string;
  department_id?: string;
  location?: string;
  status?: string;
  avatar_url?: string;
  manager_id?: string;
}

interface EmployeeJourneyProps {
  employeeId: string;
  onBack?: () => void;
}

export const EmployeeJourney = ({ employeeId, onBack }: EmployeeJourneyProps) => {
  const [employee, setEmployee] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmployee();
  }, [employeeId]);

  const fetchEmployee = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', employeeId)
        .single();

      if (error) throw error;
      setEmployee(data);
    } catch (error) {
      console.error('Error fetching employee:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-muted-foreground">Loading employee journey...</div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-semibold text-foreground mb-2">Employee not found</h3>
        {onBack && (
          <Button onClick={onBack} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Sidebar */}
      <div className="lg:col-span-1">
        <EmployeeSidebar employee={employee} onEmployeeUpdate={fetchEmployee} />
      </div>

      {/* Main Content */}
      <div className="lg:col-span-3">
        <JourneyView employeeId={employeeId} />
      </div>
    </div>
  );
};