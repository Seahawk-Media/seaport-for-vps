import React, { useState, useMemo } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { trpc } from '@/lib/trpc';
import { useOrganization } from '@/hooks/useOrganization';
import { useRole } from '@/hooks/useRole';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { format, isSameDay, parseISO, isSameMonth } from 'date-fns';
import { Plus, Calendar as CalendarIcon, Trash2, PartyPopper, Palmtree } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Holiday {
  id: string;
  name: string;
  date: string;
  description: string | null;
  isRecurring: boolean;
  country: string | null;
}

interface TimeOffEvent {
  id: string;
  profileId: string;
  startDate: string;
  endDate: string;
  requestType: string;
  status: string;
}

// Common country list for selection
const COUNTRIES = [
  { code: '', label: 'General (All Employees)' },
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'IN', label: 'India' },
  { code: 'CA', label: 'Canada' },
  { code: 'AU', label: 'Australia' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
  { code: 'PH', label: 'Philippines' },
  { code: 'SG', label: 'Singapore' },
  { code: 'AE', label: 'United Arab Emirates' },
];

export const HolidayCalendar: React.FC = () => {
  const { organization } = useOrganization();
  const { isAdmin, isSuperAdmin } = useRole();
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newHoliday, setNewHoliday] = useState({
    name: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    description: '',
    isRecurring: false,
    country: '',
  });

  const canManageHolidays = isAdmin() || isSuperAdmin();

  // Fetch current user's profile for location
  const { data: myProfile } = trpc.profiles.me.useQuery();

  const userLocation = useMemo(() => {
    if (!myProfile?.location) return null;
    const location = myProfile.location.toUpperCase();
    const matchedCountry = COUNTRIES.find(c =>
      c.code && (location.includes(c.code) || location.includes(c.label.toUpperCase()))
    );
    return matchedCountry?.code || null;
  }, [myProfile?.location]);

  const utils = trpc.useUtils();

  // Fetch holidays
  const { data: rawHolidays = [] } = trpc.calendar.listHolidays.useQuery(
    undefined,
    { enabled: !!organization?.id }
  );

  // Fetch time off requests
  const { data: rawTimeOffRequests = [] } = trpc.timeOff.listRequests.useQuery(
    undefined,
    { enabled: !!organization?.id }
  );

  // Fetch all profiles for displaying names
  const { data: allProfiles = [] } = trpc.profiles.list.useQuery();

  // Filter holidays by user location and current month
  const holidays: Holiday[] = useMemo(() => {
    return (rawHolidays as Holiday[]).filter(h => {
      const isGeneralHoliday = !h.country;
      const isUserCountryHoliday = userLocation && h.country === userLocation;
      const countryMatch = isGeneralHoliday || isUserCountryHoliday;
      if (!countryMatch) return false;

      const holidayDate = parseISO(h.date);
      if (h.isRecurring) return true;
      return isSameMonth(holidayDate, currentMonth);
    });
  }, [rawHolidays, currentMonth, userLocation]);

  // Filter approved time off events
  const timeOffEvents: (TimeOffEvent & { profile?: { fullName: string; avatarUrl: string | null } })[] = useMemo(() => {
    return (rawTimeOffRequests as TimeOffEvent[])
      .filter(r => r.status === 'approved')
      .map(r => ({
        ...r,
        profile: (allProfiles as Array<{ id: string; fullName: string; avatarUrl: string | null }>).find((p) => p.id === r.profileId),
      }));
  }, [rawTimeOffRequests, allProfiles]);

  const createHolidayMutation = trpc.calendar.createHoliday.useMutation({
    onSuccess: () => {
      toast({ title: 'Holiday added', description: `${newHoliday.name} has been added to the calendar.` });
      setShowAddDialog(false);
      setNewHoliday({ name: '', date: format(new Date(), 'yyyy-MM-dd'), description: '', isRecurring: false, country: '' });
      utils.calendar.listHolidays.invalidate();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to add holiday.', variant: 'destructive' });
    },
  });

  const deleteHolidayMutation = trpc.calendar.deleteHoliday.useMutation({
    onSuccess: () => {
      toast({ title: 'Holiday deleted', description: 'The holiday has been removed from the calendar.' });
      utils.calendar.listHolidays.invalidate();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete holiday.', variant: 'destructive' });
    },
  });

  const handleAddHoliday = () => {
    if (!newHoliday.name || !newHoliday.date) return;
    createHolidayMutation.mutate({
      name: newHoliday.name,
      date: newHoliday.date,
      description: newHoliday.description || undefined,
      isRecurring: newHoliday.isRecurring,
      country: newHoliday.country || undefined,
    });
  };

  const handleDeleteHoliday = (holidayId: string) => {
    deleteHolidayMutation.mutate({ id: holidayId });
  };

  const getHolidaysForDate = (date: Date) => {
    return holidays.filter(h => {
      const holidayDate = parseISO(h.date);
      if (h.isRecurring) {
        return holidayDate.getMonth() === date.getMonth() &&
               holidayDate.getDate() === date.getDate();
      }
      return isSameDay(holidayDate, date);
    });
  };

  const getTimeOffsForDate = (date: Date) => {
    return timeOffEvents.filter(t => {
      const start = parseISO(t.startDate);
      const end = parseISO(t.endDate);
      return date >= start && date <= end;
    });
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const modifiers = {
    holiday: (date: Date) => getHolidaysForDate(date).length > 0,
    timeoff: (date: Date) => getTimeOffsForDate(date).length > 0,
  };

  const modifiersStyles = {
    holiday: {
      backgroundColor: 'hsl(var(--destructive) / 0.2)',
      borderRadius: '50%',
    },
    timeoff: {
      border: '2px solid hsl(var(--primary))',
      borderRadius: '50%',
    },
  };

  const selectedDateHolidays = selectedDate ? getHolidaysForDate(selectedDate) : [];
  const selectedDateTimeOffs = selectedDate ? getTimeOffsForDate(selectedDate) : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Calendar */}
      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Event Calendar
            </CardTitle>
            <CardDescription>
              View company events, holidays, and team time-off
            </CardDescription>
          </div>
          {canManageHolidays && (
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Holiday
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Holiday</DialogTitle>
                  <DialogDescription>
                    Add a company-wide holiday to the calendar.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Holiday Name</Label>
                    <Input
                      id="name"
                      value={newHoliday.name}
                      onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                      placeholder="e.g., Christmas Day"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={newHoliday.date}
                      onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description (optional)</Label>
                    <Textarea
                      id="description"
                      value={newHoliday.description}
                      onChange={(e) => setNewHoliday({ ...newHoliday, description: e.target.value })}
                      placeholder="Additional details about this holiday"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country/Region</Label>
                    <select
                      id="country"
                      value={newHoliday.country}
                      onChange={(e) => setNewHoliday({ ...newHoliday, country: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      {COUNTRIES.map((country) => (
                        <option key={country.code} value={country.code}>
                          {country.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      Leave as "General" for company-wide holidays
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="recurring"
                      checked={newHoliday.isRecurring}
                      onCheckedChange={(checked) => setNewHoliday({ ...newHoliday, isRecurring: checked })}
                    />
                    <Label htmlFor="recurring">Recurring annually</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddHoliday}>Add Holiday</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            month={currentMonth}
            onMonthChange={setCurrentMonth}
            modifiers={modifiers}
            modifiersStyles={modifiersStyles}
            className="rounded-md border w-full"
            classNames={{
              months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0 w-full",
              month: "space-y-4 w-full",
              table: "w-full border-collapse space-y-1",
              head_row: "flex w-full",
              head_cell: "text-muted-foreground rounded-md flex-1 font-normal text-[0.8rem]",
              row: "flex w-full mt-2",
              cell: "flex-1 h-12 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
              day: "h-12 w-full p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground rounded-md transition-colors",
              day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
              day_today: "bg-accent text-accent-foreground",
              day_outside: "day-outside text-muted-foreground opacity-50",
            }}
          />
          <div className="flex items-center gap-4 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-destructive/20"></div>
              <span className="text-muted-foreground">Holiday</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full border-2 border-primary"></div>
              <span className="text-muted-foreground">Team member off</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selected Date Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {selectedDate ? format(selectedDate, 'MMMM d, yyyy') : 'Select a date'}
          </CardTitle>
          <CardDescription>
            {selectedDate ? (
              selectedDateHolidays.length === 0 && selectedDateTimeOffs.length === 0
                ? 'No events on this day'
                : `${selectedDateHolidays.length} holiday(s), ${selectedDateTimeOffs.length} team member(s) off`
            ) : (
              'Click on a date to see details'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] pr-4">
            {selectedDate && (
              <div className="space-y-4">
                {/* Holidays */}
                {selectedDateHolidays.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <PartyPopper className="h-4 w-4 text-destructive" />
                      Company Holidays
                    </h4>
                    {selectedDateHolidays.map((holiday) => (
                      <div
                        key={holiday.id}
                        className="p-3 bg-destructive/10 rounded-lg border border-destructive/20"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{holiday.name}</p>
                            {holiday.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {holiday.description}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-1 mt-2">
                              {holiday.isRecurring && (
                                <Badge variant="outline" className="text-xs">
                                  Recurring annually
                                </Badge>
                              )}
                              {holiday.country ? (
                                <Badge variant="secondary" className="text-xs">
                                  {COUNTRIES.find(c => c.code === holiday.country)?.label || holiday.country}
                                </Badge>
                              ) : (
                                <Badge className="text-xs bg-primary/20 text-primary hover:bg-primary/30">
                                  General
                                </Badge>
                              )}
                            </div>
                          </div>
                          {canManageHolidays && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteHoliday(holiday.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Time Off */}
                {selectedDateTimeOffs.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <Palmtree className="h-4 w-4 text-primary" />
                      Team Members Off
                    </h4>
                    {selectedDateTimeOffs.map((timeoff) => (
                      <div
                        key={timeoff.id}
                        className="p-3 bg-primary/5 rounded-lg border border-primary/20"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={timeoff.profile?.avatarUrl || undefined} />
                            <AvatarFallback className="text-xs">
                              {getInitials(timeoff.profile?.fullName)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">
                              {timeoff.profile?.fullName || 'Unknown'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {timeoff.requestType} {'\u2022'} {format(parseISO(timeoff.startDate), 'MMM d')} - {format(parseISO(timeoff.endDate), 'MMM d')}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Empty state */}
                {selectedDateHolidays.length === 0 && selectedDateTimeOffs.length === 0 && (
                  <div className="text-center py-8">
                    <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">No events on this day</p>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
