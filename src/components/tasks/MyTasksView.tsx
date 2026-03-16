import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckSquare, Calendar, LayoutList, Columns, Edit, Trash2, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
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
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
  team?: { id: string; name: string } | null;
  assignee?: { id: string; full_name: string | null; avatar_url: string | null } | null;
  department?: { id: string; name: string } | null;
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

const DeptTag = ({ task }: { task: Task }) => {
  const label = task.team?.name || task.department?.name;
  if (!label) return null;
  return (
    <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20 gap-1">
      <Tag className="h-2.5 w-2.5" />
      {label}
    </Badge>
  );
};

// Droppable column
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
  onEdit,
  onDelete,
}: {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

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
        <DeptTag task={task} />
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

export const MyTasksView: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const { toast } = useToast();
  const { organization } = useOrganization();
  const { user } = useAuth();
  const { isAdmin, isSuperAdmin, isManager } = useRole();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  useEffect(() => {
    if (organization && user) fetchMyTasks();
  }, [organization, user]);

  const fetchMyTasks = async () => {
    if (!user || !organization) return;
    setLoading(true);
    try {
      // Get current user's profile id
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) { setLoading(false); return; }

      const { data, error } = await supabase
        .from('tasks')
        .select('*, team:teams(id, name), assignee:profiles!tasks_assigned_to_fkey(id, full_name, avatar_url), department:departments(id, name)')
        .eq('organization_id', organization.id)
        .eq('assigned_to', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks((data || []) as unknown as Task[]);
    } catch (err) {
      console.error('Error fetching my tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const quickStatusChange = async (taskId: string, newStatus: string) => {
    const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);
    if (!error) fetchMyTasks();
    else toast({ title: "Error", description: error.message, variant: "destructive" });
  };

  const handleDelete = async (id: string) => {
    const canDelete = isAdmin() || isSuperAdmin() || isManager();
    if (!canDelete) {
      toast({ title: "Permission denied", description: "Only managers and admins can delete tasks.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Task deleted" }); fetchMyTasks(); }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTask(tasks.find(t => t.id === event.active.id) || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;
    const taskId = active.id as string;
    const overStatus = KANBAN_COLUMNS.includes(over.id as keyof typeof STATUS_CONFIG)
      ? (over.id as string)
      : tasks.find(t => t.id === over.id)?.status;
    if (!overStatus) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === overStatus) return;
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: overStatus } : t));
    const { error } = await supabase.from('tasks').update({ status: overStatus }).eq('id', taskId);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); fetchMyTasks(); }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Loading your tasks...</div>;
  }

  const grouped = KANBAN_COLUMNS.reduce((acc, s) => {
    acc[s] = tasks.filter(t => t.status === s);
    return acc;
  }, {} as Record<string, Task[]>);

  return (
    <div className="space-y-4">
      {/* Sub-header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {tasks.length} task{tasks.length !== 1 ? 's' : ''} assigned to you
        </p>
        <div className="flex items-center border border-border rounded-md overflow-hidden">
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 transition-colors ${viewMode === 'list' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50'}`}
            aria-label="List view"
          >
            <LayoutList className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('kanban')}
            className={`p-1.5 transition-colors ${viewMode === 'kanban' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50'}`}
            aria-label="Kanban view"
          >
            <Columns className="h-4 w-4" />
          </button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border rounded-lg">
          <CheckSquare className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No tasks assigned to you</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Tasks assigned to you will appear here</p>
        </div>
      ) : viewMode === 'list' ? (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-0 text-xs font-medium text-muted-foreground bg-muted/50 px-4 py-2 border-b border-border">
            <span>Task</span>
            <span className="w-28 text-center">Department</span>
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
                <DeptTag task={task} />
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
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(task.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        // KANBAN with DnD
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
                          onEdit={() => {}}
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
    </div>
  );
};
