import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { HolidayCalendar } from '@/components/calendar/HolidayCalendar';

export default function HolidayCalendarPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  if (authLoading) {
    return (
      <DashboardLayout title="Event Calendar" description="View company events, holidays, and team time-off">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Event Calendar"
      description="View company events, holidays, and team time-off"
    >
      <HolidayCalendar />
    </DashboardLayout>
  );
}
