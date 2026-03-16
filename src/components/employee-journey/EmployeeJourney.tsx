import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { JourneyView } from './JourneyView';
import { EmployeeSidebar } from './EmployeeSidebar';

interface EmployeeJourneyProps {
  employeeId: string;
  onBack?: () => void;
}

export const EmployeeJourney = ({ employeeId, onBack }: EmployeeJourneyProps) => {
  const { data: employee, isLoading: loading, refetch } = trpc.profiles.get.useQuery({ id: employeeId });

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
        <EmployeeSidebar employee={employee} onEmployeeUpdate={() => refetch()} />
      </div>

      {/* Main Content */}
      <div className="lg:col-span-3">
        <JourneyView employeeId={employeeId} />
      </div>
    </div>
  );
};
