import React, { useState, useEffect } from 'react';
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
import { supabase } from "@/integrations/supabase/client";
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
  meeting_url: string | null;
  recurrence: string | null;
  scheduled_at: string | null;
  duration_minutes: number | null;
  team_id: string | null;
  department_id: string | null;
  team?: { id: string; name: string; department_id: string | null } | null;
}

interface Department {
  id: string;
  name: string;
}

interface Team {
  id: string;
  name: string;
  department_id: string | null;
}

export const MeetingsTab: React.FC<MeetingsTabProps> = ({ departmentId, teamId, showAllFunctions = false, showDeptAll = false }) => {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    meeting_url: '',
    recurrence: 'weekly',
    scheduled_at: '',
    duration_minutes: 60,
    team_id: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterFunction, setFilterFunction] = useState('all');
  const { toast } = useToast();
  const { isAdmin, isSuperAdmin, isManager } = useRole();
  const { organization } = useOrganization();

  const canManage = isAdmin() || isSuperAdmin() || isManager();

  useEffect(() => {
    fetchData();
  }, [departmentId, teamId, showAllFunctions, showDeptAll]);

  const fetchData = async () => {
    try {
      let query = supabase.from('meetings').select('*, team:teams(id, name, department_id)');
      
      if (showAllFunctions) {
        // Show all meetings across all functions
      } else if (teamId) {
        query = query.eq('team_id', teamId);
      } else if (showDeptAll && departmentId) {
        // Department master list: all meetings where department_id matches (incl. function-level)
        query = query.eq('department_id', departmentId);
      } else if (departmentId) {
        query = query.eq('department_id', departmentId).is('team_id', null);
      }

      const [meetingsRes, deptRes, teamsRes] = await Promise.all([
        query.order('scheduled_at', { ascending: true, nullsFirst: false }),
        supabase.from('departments').select('id, name').order('name'),
        supabase.from('teams').select('id, name, department_id').order('name')
      ]);

      if (meetingsRes.error) throw meetingsRes.error;
      setMeetings(meetingsRes.data || []);
      setDepartments(deptRes.data || []);
      setTeams(teamsRes.data || []);
    } catch (error) {
      console.error('Error fetching meetings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization) return;

    if (showAllFunctions && !formData.team_id) {
      toast({ title: "Error", description: "Please select a function", variant: "destructive" });
      return;
    }

    const selectedTeam = teams.find(t => t.id === formData.team_id);

    try {
      const payload = {
        title: formData.title,
        description: formData.description || null,
        meeting_url: formData.meeting_url || null,
        recurrence: formData.recurrence,
        scheduled_at: formData.scheduled_at || null,
        duration_minutes: formData.duration_minutes,
        team_id: showAllFunctions ? (formData.team_id || null) : (teamId || null),
        department_id: showAllFunctions ? (selectedTeam?.department_id || null) : (departmentId || null),
      };

      if (editingMeeting) {
        const { error } = await supabase
          .from('meetings')
          .update(payload)
          .eq('id', editingMeeting.id);

        if (error) throw error;
        toast({ title: "Meeting updated" });
      } else {
        const { error } = await supabase
          .from('meetings')
          .insert({
            ...payload,
            organization_id: organization.id,
          });

        if (error) throw error;
        toast({ title: "Meeting added" });
      }

      resetForm();
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const resetForm = () => {
    setDialogOpen(false);
    setEditingMeeting(null);
    setFormData({ title: '', description: '', meeting_url: '', recurrence: 'weekly', scheduled_at: '', duration_minutes: 60, team_id: '' });
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('meetings').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Meeting deleted" });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const openEdit = (meeting: Meeting) => {
    setEditingMeeting(meeting);
    setFormData({
      title: meeting.title,
      description: meeting.description || '',
      meeting_url: meeting.meeting_url || '',
      recurrence: meeting.recurrence || 'weekly',
      scheduled_at: meeting.scheduled_at ? meeting.scheduled_at.slice(0, 16) : '',
      duration_minutes: meeting.duration_minutes || 60,
      team_id: meeting.team_id || ''
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
    
    const meetingDeptId = meeting.team?.department_id || meeting.department_id;
    const matchesDept = filterDepartment === 'all' || meetingDeptId === filterDepartment;
    const matchesFunc = filterFunction === 'all' || meeting.team_id === filterFunction;
    
    return matchesSearch && matchesDept && matchesFunc;
  });

  const filteredTeams = filterDepartment === 'all' 
    ? teams 
    : teams.filter(t => t.department_id === filterDepartment);

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
                    <Select value={formData.team_id} onValueChange={(v) => setFormData({ ...formData, team_id: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select function" />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.map(team => {
                          const dept = departments.find(d => d.id === team.department_id);
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
                  value={formData.meeting_url}
                  onChange={(e) => setFormData({ ...formData, meeting_url: e.target.value })}
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
                  value={formData.scheduled_at}
                  onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                />
                <Input
                  type="number"
                  placeholder="Duration (minutes)"
                  value={formData.duration_minutes}
                  onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 60 })}
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
                const dept = departments.find(d => d.id === (meeting.team?.department_id || meeting.department_id));
                return (
                  <TableRow key={meeting.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {meeting.title}
                        {meeting.meeting_url && (
                          <a href={meeting.meeting_url} target="_blank" rel="noopener noreferrer" className="text-primary">
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {meeting.scheduled_at ? format(new Date(meeting.scheduled_at), 'PPp') : '-'}
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
                {meeting.scheduled_at && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(meeting.scheduled_at), 'PPp')}
                    {meeting.duration_minutes && ` (${meeting.duration_minutes} min)`}
                  </div>
                )}
                {meeting.meeting_url && (
                  <a
                    href={meeting.meeting_url}
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
