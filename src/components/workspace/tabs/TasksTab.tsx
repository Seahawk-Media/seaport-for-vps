import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, CheckSquare, Edit, Trash2, Calendar, LayoutList, Columns, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';

interface TasksTabProps {
  departmentId?: string;
  teamId?: string;
  departmentName?: string;
  /** Show ALL tasks for a department (master list incl. function-level items) */
  showDeptAll?: boolean;
}

interface Team {
  id: string;
  name: string;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  assigned_to: string | null;
  team_id: string | null;
  department_id: string | null;
  team?: Team | null;
  assignee?: { id: string; full_name: string | null; avatar_url: string | null } | null;
}

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

const STATUS_CONFIG = {
  todo: { label: 'To Do', className: 'bg-muted text-muted-foreground border-border' },
  in_progress: { label: 'In Progress', className: 'bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800 dark:text-blue-400' },
  done: { label: 'Done', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800 dark:text-emerald-400' },
  stuck: { label: 'Stuck', className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

const PRIORITY_CONFIG = {
  low: { label: 'Low', className: 'bg-muted text-muted-foreground border-border' },
  medium: { label: 'Medium', className: 'bg-yellow-500/10 text-yellow-600 border-yellow-200 dark:border-yellow-800 dark:text-yellow-400' },
  high: { label: 'High', className: 'bg-orange-500/10 text-orange-600 border-orange-200 dark:border-orange-800 dark:text-orange-400' },
  urgent: { label: 'Urgent', className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

const KANBAN_COLUMNS: Array<keyof typeof STATUS_CONFIG> = ['todo', 'in_progress', 'done', 'stuck'];

const getInitials = (name: string | null) =>
  name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

const StatusBadge = ({ status }: { status: string | null }) => {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.todo;
  return <Badge variant="outline" className={`text-xs font-medium ${cfg.className}`}>{cfg.label}</Badge>;
};

const PriorityBadge = ({ priority }: { priority: string | null }) => {
  const cfg = PRIORITY_CONFIG[priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium;
  return <Badge variant="outline" className={`text-xs font-medium ${cfg.className}`}>{cfg.label}</Badge>;
};

const FunctionTag = ({ team, departmentName }: { team?: Team | null; departmentName?: string }) => {
  if (team) {
    return (
      <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20 gap-1">
        <Tag className="h-2.5 w-2.5" />
        {team.name}
      </Badge>
    );
  }
  if (departmentName) {
    return (
      <Badge variant="outline" className="text-xs bg-muted text-muted-foreground gap-1">
        <Tag className="h-2.5 w-2.5" />
        {departmentName}
      </Badge>
    );
  }
  return null;
};

const emptyForm = {
  title: '',
  description: '',
  status: 'todo',
  priority: 'medium',
  due_date: '',
  assigned_to: 'none',
  team_id: 'none',
};

// Droppable column wrapper
const DroppableColumn = ({ id, children }: { id: string; children: React.ReactNode }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`space-y-2 min-h-[60px] rounded-lg transition-colors ${isOver ? 'bg-accent/30' : ''}`}
    >
      {children}
    </div>
  );
};

// Sortable kanban card
const SortableKanbanCard = ({
  task,
  departmentName,
  onEdit,
  onDelete,
}: {
  task: Task;
  departmentName?: string;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-card border border-border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow group cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug">{task.title}</p>
        <div
          className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground" onClick={() => onEdit(task)}>
            <Edit className="h-2.5 w-2.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive" onClick={() => onDelete(task.id)}>
            <Trash2 className="h-2.5 w-2.5" />
          </Button>
        </div>
      </div>
      {task.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{task.description}</p>
      )}
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <FunctionTag team={task.team} departmentName={departmentName} />
        <PriorityBadge priority={task.priority} />
      </div>
      <div className="flex items-center justify-between mt-2">
        {task.due_date ? (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="h-2.5 w-2.5" />
            {format(new Date(task.due_date + 'T00:00:00'), 'MMM d')}
          </span>
        ) : <span />}
        {task.assignee && (
          <Avatar className="h-5 w-5">
            <AvatarImage src={task.assignee.avatar_url || ''} />
            <AvatarFallback className="text-xs bg-primary/10 text-primary">{getInitials(task.assignee.full_name)}</AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  );
};

export const TasksTab: React.FC<TasksTabProps> = ({ departmentId, teamId, departmentName, showDeptAll = false }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [functions, setFunctions] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const { toast } = useToast();
  const { organization } = useOrganization();
  const { user } = useAuth();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  useEffect(() => {
    fetchTasks();
    fetchMembers();
    if (departmentId && !teamId) fetchFunctions();
  }, [departmentId, teamId]);

  const fetchFunctions = async () => {
    if (!departmentId) return;
    const { data } = await supabase
      .from('teams')
      .select('id, name')
      .eq('department_id', departmentId)
      .order('name');
    setFunctions(data || []);
  };

  const fetchMembers = async () => {
    let query = supabase.from('profiles').select('id, full_name, avatar_url');
    if (teamId) {
      const { data: tm } = await supabase.from('team_members').select('profile_id').eq('team_id', teamId);
      const ids = tm?.map(r => r.profile_id) || [];
      if (ids.length > 0) query = query.in('id', ids);
    } else if (departmentId) {
      query = query.eq('department_id', departmentId);
    }
    const { data } = await query.order('full_name');
    setMembers(data || []);
  };

  const fetchTasks = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('tasks')
        .select('*, team:teams(id, name), assignee:profiles!tasks_assigned_to_fkey(id, full_name, avatar_url)');

      if (teamId) {
        query = query.eq('team_id', teamId);
      } else if (departmentId) {
        query = query.eq('department_id', departmentId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      setTasks((data || []) as unknown as Task[]);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization || !user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    const payload = {
      title: formData.title,
      description: formData.description || null,
      status: formData.status,
      priority: formData.priority,
      due_date: formData.due_date || null,
      assigned_to: formData.assigned_to === 'none' ? null : formData.assigned_to || null,
      team_id: teamId || (formData.team_id === 'none' ? null : formData.team_id || null),
    };

    try {
      if (editingTask) {
        const { error } = await supabase.from('tasks').update(payload).eq('id', editingTask.id);
        if (error) throw error;
        toast({ title: "Task updated" });
      } else {
        const { error } = await supabase.from('tasks').insert({
          ...payload,
          organization_id: organization.id,
          department_id: departmentId || null,
          created_by: profile?.id || null,
        });
        if (error) throw error;
        toast({ title: "Task created" });
      }
      resetForm();
      fetchTasks();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const resetForm = () => {
    setDialogOpen(false);
    setEditingTask(null);
    setFormData(emptyForm);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Task deleted" });
      fetchTasks();
    }
  };

  const openEdit = (task: Task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      status: task.status || 'todo',
      priority: task.priority || 'medium',
      due_date: task.due_date || '',
      assigned_to: task.assigned_to || 'none',
      team_id: task.team_id || 'none',
    });
    setDialogOpen(true);
  };

  const quickStatusChange = async (taskId: string, newStatus: string) => {
    const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);
    if (!error) fetchTasks();
  };

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find(t => t.id === event.active.id);
    setActiveTask(task || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    // The over.id can be either a column id or a card id — find the column
    const overStatus = KANBAN_COLUMNS.includes(over.id as keyof typeof STATUS_CONFIG)
      ? (over.id as string)
      : tasks.find(t => t.id === over.id)?.status;

    if (!overStatus) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === overStatus) return;

    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: overStatus } : t));
    const { error } = await supabase.from('tasks').update({ status: overStatus }).eq('id', taskId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      fetchTasks();
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Loading tasks...</div>;
  }

  const grouped = KANBAN_COLUMNS.reduce((acc, s) => {
    acc[s] = tasks.filter(t => t.status === s);
    return acc;
  }, {} as Record<string, Task[]>);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Tasks</h2>
          <p className="text-xs text-muted-foreground">{tasks.length} task{tasks.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-border rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 transition-colors ${viewMode === 'list' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50'}`}
            >
              <LayoutList className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 transition-colors ${viewMode === 'kanban' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50'}`}
            >
              <Columns className="h-4 w-4" />
            </button>
          </div>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Task
          </Button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-lg">
          <CheckSquare className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No tasks yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Create a task to get started</p>
        </div>
      ) : viewMode === 'list' ? (
        // LIST VIEW
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-0 text-xs font-medium text-muted-foreground bg-muted/50 px-4 py-2 border-b border-border">
            <span>Task</span>
            <span className="w-28 text-center">Function</span>
            <span className="w-20 text-center">Assignee</span>
            <span className="w-24 text-center">Status</span>
            <span className="w-20 text-center">Due</span>
            <span className="w-16 text-center">Actions</span>
          </div>
          {tasks.map((task, i) => (
            <div
              key={task.id}
              className={`grid grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-0 px-4 py-3 hover:bg-muted/30 transition-colors ${i < tasks.length - 1 ? 'border-b border-border' : ''}`}
            >
              <div className="min-w-0 pr-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{task.title}</span>
                  <PriorityBadge priority={task.priority} />
                </div>
                {task.description && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{task.description}</p>
                )}
              </div>
              <div className="w-28 flex justify-center">
                <FunctionTag team={task.team} departmentName={departmentName} />
              </div>
              <div className="w-20 flex justify-center">
                {task.assignee ? (
                  <div className="flex items-center gap-1.5">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={task.assignee.avatar_url || ''} />
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">{getInitials(task.assignee.full_name)}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground truncate max-w-[60px] hidden sm:block">
                      {task.assignee.full_name?.split(' ')[0]}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground/40">—</span>
                )}
              </div>
              <div className="w-24 flex justify-center">
                <Select value={task.status || 'todo'} onValueChange={(v) => quickStatusChange(task.id, v)}>
                  <SelectTrigger className="border-0 shadow-none p-0 h-auto bg-transparent w-auto focus:ring-0">
                    <StatusBadge status={task.status} />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                      <SelectItem key={val} value={val}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-20 flex justify-center">
                {task.due_date ? (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(task.due_date + 'T00:00:00'), 'MMM d')}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground/40">—</span>
                )}
              </div>
              <div className="w-16 flex justify-center gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => openEdit(task)}>
                  <Edit className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(task.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        // KANBAN VIEW — drag-and-drop enabled
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {KANBAN_COLUMNS.map((status) => {
              const cfg = STATUS_CONFIG[status];
              const columnTasks = grouped[status] || [];
              return (
                <div key={status} className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <Badge variant="outline" className={`text-xs font-medium ${cfg.className}`}>{cfg.label}</Badge>
                    <span className="text-xs text-muted-foreground ml-auto">{columnTasks.length}</span>
                  </div>
                  <SortableContext items={columnTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                    <DroppableColumn id={status}>
                      {columnTasks.map((task) => (
                        <SortableKanbanCard
                          key={task.id}
                          task={task}
                          departmentName={departmentName}
                          onEdit={openEdit}
                          onDelete={handleDelete}
                        />
                      ))}
                    </DroppableColumn>
                  </SortableContext>
                </div>
              );
            })}
          </div>
          <DragOverlay>
            {activeTask && (
              <div className="bg-card border border-primary/30 rounded-lg p-3 shadow-xl rotate-1 opacity-95">
                <p className="text-sm font-medium leading-snug">{activeTask.title}</p>
                <div className="flex items-center gap-2 mt-2">
                  <PriorityBadge priority={activeTask.priority} />
                </div>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); else setDialogOpen(true); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Edit Task' : 'Create Task'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              placeholder="Task title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
            <Textarea
              placeholder="Description (optional)"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Status</label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                      <SelectItem key={val} value={val}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Priority</label>
                <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_CONFIG).map(([val, cfg]) => (
                      <SelectItem key={val} value={val}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Function tag selector — only show when viewing dept-level (not locked to a function) */}
            {!teamId && functions.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Function tag</label>
                <Select value={formData.team_id} onValueChange={(v) => setFormData({ ...formData, team_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Department (no function)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Department (no function)</SelectItem>
                    {functions.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Due date</label>
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Assignee</label>
                <Select value={formData.assigned_to} onValueChange={(v) => setFormData({ ...formData, assigned_to: v })}>
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {members.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" className="w-full">
              {editingTask ? 'Update Task' : 'Create Task'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
