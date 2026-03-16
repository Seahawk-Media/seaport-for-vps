import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Calendar, User, Award, FileText, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { AddEventModal } from './AddEventModal';

interface JourneyViewProps {
  employeeId: string;
}

export const JourneyView = ({ employeeId }: JourneyViewProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: events = [], isLoading: loading, refetch } = trpc.activity.list.useQuery(
    { limit: 100 },
    {
      select: (data) =>
        data
          .filter((e: any) => e.profileId === employeeId)
          .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    }
  );

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'hire': return <User className="w-4 h-4" />;
      case 'promotion': return <Award className="w-4 h-4" />;
      case 'performance_review': return <FileText className="w-4 h-4" />;
      case 'training': return <Award className="w-4 h-4" />;
      case 'disciplinary': return <FileText className="w-4 h-4" />;
      case 'leave': return <Calendar className="w-4 h-4" />;
      case 'termination': return <User className="w-4 h-4" />;
      case 'other': return <FileText className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'hire': return 'bg-green-100 text-green-800 border-green-200';
      case 'promotion': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'performance_review': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'training': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'disciplinary': return 'bg-red-100 text-red-800 border-red-200';
      case 'leave': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'termination': return 'bg-red-100 text-red-800 border-red-200';
      case 'other': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleEventAdded = () => {
    refetch();
    setIsModalOpen(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-muted-foreground">Loading journey...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Journey Events</h3>
        <Button onClick={() => setIsModalOpen(true)} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Event
        </Button>
      </div>

      {events.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h4 className="text-lg font-semibold text-foreground mb-2">No Journey Events Yet</h4>
            <p className="text-muted-foreground mb-4">
              Start documenting this employee's journey by adding their first journey event.
            </p>
            <Button onClick={() => setIsModalOpen(true)} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Add First Event
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {events.map((event: any) => (
            <Card key={event.id} className="relative">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className={`p-2 rounded-full ${getEventColor(event.activityType)}`}>
                      {getEventIcon(event.activityType)}
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-foreground">{event.description}</h4>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={getEventColor(event.activityType)}>
                          {event.activityType.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(event.createdAt)}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddEventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        employeeId={employeeId}
        onEventAdded={handleEventAdded}
      />
    </div>
  );
};
