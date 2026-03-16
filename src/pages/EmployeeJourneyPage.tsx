import { useNavigate, useParams } from 'react-router-dom';
import { EmployeeJourney } from '@/components/employee-journey/EmployeeJourney';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

export const EmployeeJourneyPage = () => {
  const navigate = useNavigate();
  const { employeeId } = useParams<{ employeeId: string }>();

  if (!employeeId) {
    navigate('/dashboard');
    return null;
  }

  return (
    <DashboardLayout viewMode="my-journey" title="Employee Journey">
      <EmployeeJourney
        employeeId={employeeId}
        onBack={() => navigate(-1)}
      />
    </DashboardLayout>
  );
};
