import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Calendar, FileText, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { AddEventModal } from './AddEventModal';

interface JourneyViewProps {
  employeeId: string;
}

const COLOR_MAP: Record<string, string> = {
  gray: 'bg-gray-100 text-gray-800 border-gray-200',
  green: 'bg-green-100 text-green-800 border-green-200',
  blue: 'bg-blue-100 text-blue-800 border-blue-200',
  purple: 'bg-purple-100 text-purple-800 border-purple-200',
  yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  orange: 'bg-orange-100 text-orange-800 border-orange-200',
  red: 'bg-red-100 text-red-800 border-red-200',
  pink: 'bg-pink-100 text-pink-800 border-pink-200',
  indigo: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  teal: 'bg-teal-100 text-teal-800 border-teal-200',
  amber: 'bg-amber-100 text-amber-800 border-amber-200',
  slate: 'bg-slate-100 text-slate-800 border-slate-200',
};

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

  // Fetch org's configured event types to get colors/labels
  const { data: eventTypes = [] } = trpc.journeyEventTypes.listActive.useQuery();

  const eventTypeMap = useMemo(() => {
    const map: Record<string, { name: string; color: string }> = {};
    eventTypes.forEach((t: any) => {
      map[t.slug] = { name: t.name, color: t.color || 'gray' };
    });
    return map;
  }, [eventTypes]);

  const getEventColor = (eventType: string) => {
    const config = eventTypeMap[eventType];
    return COLOR_MAP[config?.color || 'gray'] || COLOR_MAP.gray;
  };

  const getEventLabel = (eventType: string) => {
    return eventTypeMap[eventType]?.name || eventType.replace(/[-_]/g, ' ');
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
                      <FileText className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-foreground">{event.description}</h4>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={getEventColor(event.activityType)}>
                          {getEventLabel(event.activityType)}
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
