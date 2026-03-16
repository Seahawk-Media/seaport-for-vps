import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Video, ExternalLink, Edit, Trash2, Calendar, Search, Building, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/useRole";
import { useOrganization } from "@/hooks/useOrganization";
import { format } from "date-fns";

interface MeetingsTabProps {
  departmentId?: string;
  teamId?: string;
  showAllFunctions?: boolean;
  /** Show ALL meetings for a department (master list incl. function-level items) */
  showDeptAll?: boolean;
}

interface Meeting {
  id: string;
  title: string;
  description: string | null;
  meetingUrl: string | null;
  recurrence: string | null;
  scheduledAt: string | null;
  durationMinutes: number | null;
  teamId: string | null;
  departmentId: string | null;
  team?: { id: string; name: string; departmentId: string | null } | null;
}

interface Department {
  id: string;
  name: string;
}

interface Team {
  id: string;
  name: string;
  departmentId: string | null;
}

export const MeetingsTab: React.FC<MeetingsTabProps> = ({ departmentId, teamId, showAllFunctions = false, showDeptAll = false }) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    meetingUrl: '',
    recurrence: 'weekly',
    scheduledAt: '',
    durationMinutes: 60,
    teamId: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterFunction, setFilterFunction] = useState('all');
  const { toast } = useToast();
  const { isAdmin, isSuperAdmin, isManager } = useRole();
  const { organization } = useOrganization();

  const canManage = isAdmin() || isSuperAdmin() || isManager();
  const utils = trpc.useUtils();

  const meetingsQuery = trpc.meetings.list.useQuery();
  const departmentsQuery = trpc.departments.list.useQuery();
  const teamsQuery = trpc.teams.list.useQuery();

  const createMutation = trpc.meetings.create.useMutation({
    onSuccess: () => {
      toast({ title: "Meeting added" });
      resetForm();
      utils.meetings.list.invalidate();
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = trpc.meetings.update.useMutation({
    onSuccess: () => {
      toast({ title: "Meeting updated" });
      resetForm();
      utils.meetings.list.invalidate();
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = trpc.meetings.delete.useMutation({
    onSuccess: () => {
      toast({ title: "Meeting deleted" });
      utils.meetings.list.invalidate();
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const allMeetings = (meetingsQuery.data || []) as Meeting[];
  const departments = (departmentsQuery.data || []) as Department[];
  const teams = (teamsQuery.data || []) as Team[];
  const loading = meetingsQuery.isLoading;

  // Filter meetings based on scope
  const meetings = allMeetings.filter(meeting => {
    if (showAllFunctions) return true;
    if (teamId) return meeting.teamId === teamId;
    if (showDeptAll && departmentId) return meeting.departmentId === departmentId;
    if (departmentId) return meeting.departmentId === departmentId && !meeting.teamId;
    return true;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization) return;

    if (showAllFunctions && !formData.teamId) {
      toast({ title: "Error", description: "Please select a function", variant: "destructive" });
      return;
    }

    const selectedTeam = teams.find(t => t.id === formData.teamId);

    if (editingMeeting) {
      updateMutation.mutate({
        id: editingMeeting.id,
        title: formData.title,
        description: formData.description || undefined,
        scheduledAt: formData.scheduledAt || undefined,
        durationMinutes: formData.durationMinutes,
      });
    } else {
      createMutation.mutate({
        title: formData.title,
        description: formData.description || undefined,
        meetingUrl: formData.meetingUrl || undefined,
        recurrence: formData.recurrence,
        scheduledAt: formData.scheduledAt || undefined,
        durationMinutes: formData.durationMinutes,
        departmentId: showAllFunctions ? (selectedTeam?.departmentId || undefined) : (departmentId || undefined),
        teamId: showAllFunctions ? (formData.teamId || undefined) : (teamId || undefined),
      });
    }
  };

  const resetForm = () => {
    setDialogOpen(false);
    setEditingMeeting(null);
    setFormData({ title: '', description: '', meetingUrl: '', recurrence: 'weekly', scheduledAt: '', durationMinutes: 60, teamId: '' });
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate({ id });
  };

  const openEdit = (meeting: Meeting) => {
    setEditingMeeting(meeting);
    setFormData({
      title: meeting.title,
      description: meeting.description || '',
      meetingUrl: meeting.meetingUrl || '',
      recurrence: meeting.recurrence || 'weekly',
      scheduledAt: meeting.scheduledAt ? meeting.scheduledAt.slice(0, 16) : '',
      durationMinutes: meeting.durationMinutes || 60,
      teamId: meeting.teamId || ''
    });
    setDialogOpen(true);
  };

  const getRecurrenceBadge = (recurrence: string | null) => {
    const colors: Record<string, string> = {
      'daily': 'bg-blue-100 text-blue-800',
      'weekly': 'bg-green-100 text-green-800',
      'monthly': 'bg-purple-100 text-purple-800',
      'one-time': 'bg-gray-100 text-gray-800',
    };
    return colors[recurrence || 'one-time'] || colors['one-time'];
  };

  const filteredMeetings = meetings.filter(meeting => {
    const matchesSearch = meeting.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (meeting.description?.toLowerCase().includes(searchTerm.toLowerCase()));

    const meetingDeptId = meeting.team?.departmentId || meeting.departmentId;
    const matchesDept = filterDepartment === 'all' || meetingDeptId === filterDepartment;
    const matchesFunc = filterFunction === 'all' || meeting.teamId === filterFunction;

    return matchesSearch && matchesDept && matchesFunc;
  });

  const filteredTeams = filterDepartment === 'all'
    ? teams
    : teams.filter(t => t.departmentId === filterDepartment);

  if (loading) {
    return <div className="flex items-center justify-center h-48 text-muted-foreground">Loading meetings...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Meetings</h2>
          <p className="text-sm text-muted-foreground">Scheduled recurring and one-time meetings</p>
        </div>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); else setDialogOpen(true); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Meeting
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingMeeting ? 'Edit Meeting' : 'Add Meeting'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {(showAllFunctions || editingMeeting) && (
                  <div className="space-y-2">
                    <Label>Function *</Label>
                    <Select value={formData.teamId} onValueChange={(v) => setFormData({ ...formData, teamId: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select function" />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.map(team => {
                          const dept = departments.find(d => d.id === team.departmentId);
                          return (
                            <SelectItem key={team.id} value={team.id}>
                              {team.name} {dept && <span className="text-muted-foreground">({dept.name})</span>}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Input
                  placeholder="Meeting title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
                <Textarea
                  placeholder="Description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
                <Input
                  placeholder="Meeting URL (Zoom, Google Meet, etc.)"
                  value={formData.meetingUrl}
                  onChange={(e) => setFormData({ ...formData, meetingUrl: e.target.value })}
                />
                <Select value={formData.recurrence} onValueChange={(v) => setFormData({ ...formData, recurrence: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Recurrence" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="one-time">One-time</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="datetime-local"
                  value={formData.scheduledAt}
                  onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                />
                <Input
                  type="number"
                  placeholder="Duration (minutes)"
                  value={formData.durationMinutes}
                  onChange={(e) => setFormData({ ...formData, durationMinutes: parseInt(e.target.value) || 60 })}
                />
                <Button type="submit" className="w-full">
                  {editingMeeting ? 'Update' : 'Add'} Meeting
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters */}
      {showAllFunctions && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search meetings..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterDepartment} onValueChange={(v) => { setFilterDepartment(v); setFilterFunction('all'); }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map(dept => (
                <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterFunction} onValueChange={setFilterFunction}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Functions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Functions</SelectItem>
              {filteredTeams.map(team => (
                <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {filteredMeetings.length === 0 ? (
        <EmptyState icon={Video} title="No meetings found" />
      ) : showAllFunctions ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Recurrence</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Function</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMeetings.map((meeting) => {
                const dept = departments.find(d => d.id === (meeting.team?.departmentId || meeting.departmentId));
                return (
                  <TableRow key={meeting.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {meeting.title}
                        {meeting.meetingUrl && (
                          <a href={meeting.meetingUrl} target="_blank" rel="noopener noreferrer" className="text-primary">
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {meeting.scheduledAt ? format(new Date(meeting.scheduledAt), 'PPp') : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge className={getRecurrenceBadge(meeting.recurrence)}>
                        {meeting.recurrence || 'one-time'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {dept ? (
                        <Badge variant="outline" className="gap-1">
                          <Building className="h-3 w-3" />
                          {dept.name}
                        </Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {meeting.team ? (
                        <Badge variant="secondary" className="gap-1">
                          <Users className="h-3 w-3" />
                          {meeting.team.name}
                        </Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {canManage && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(meeting)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(meeting.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMeetings.map((meeting) => (
            <Card key={meeting.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{meeting.title}</CardTitle>
                    <Badge className={getRecurrenceBadge(meeting.recurrence)}>
                      {meeting.recurrence || 'one-time'}
                    </Badge>
                  </div>
                  {canManage && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(meeting)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(meeting.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                {meeting.description && <CardDescription>{meeting.description}</CardDescription>}
              </CardHeader>
              <CardContent className="space-y-2">
                {meeting.scheduledAt && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(meeting.scheduledAt), 'PPp')}
                    {meeting.durationMinutes && ` (${meeting.durationMinutes} min)`}
                  </div>
                )}
                {meeting.meetingUrl && (
                  <a
                    href={meeting.meetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    Join Meeting <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
