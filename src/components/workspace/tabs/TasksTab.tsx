import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, CheckSquare, Edit, Trash2, Calendar, LayoutList, Columns, Tag } from "lucide-react";
import { trpc } from "@/lib/trpc";
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
  dueDate: string | null;
  assignedTo: string | null;
  teamId: string | null;
  departmentId: string | null;
  team?: Team | null;
  assignee?: { id: string; fullName: string | null; avatarUrl: string | null } | null;
}

interface Profile {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
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
  dueDate: '',
  assignedTo: 'none',
  teamId: 'none',
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
        {task.dueDate ? (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="h-2.5 w-2.5" />
            {format(new Date(task.dueDate + 'T00:00:00'), 'MMM d')}
          </span>
        ) : <span />}
        {task.assignee && (
          <Avatar className="h-5 w-5">
            <AvatarImage src={task.assignee.avatarUrl || ''} />
            <AvatarFallback className="text-xs bg-primary/10 text-primary">{getInitials(task.assignee.fullName)}</AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  );
};

export const TasksTab: React.FC<TasksTabProps> = ({ departmentId, teamId, departmentName, showDeptAll = false }) => {
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

  const utils = trpc.useUtils();
  const tasksQuery = trpc.tasks.list.useQuery();
  const profilesQuery = trpc.profiles.list.useQuery();
  const teamsQuery = trpc.teams.list.useQuery();

  const createMutation = trpc.tasks.create.useMutation({
    onSuccess: () => {
      toast({ title: "Task created" });
      resetForm();
      utils.tasks.list.invalidate();
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = trpc.tasks.update.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate();
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = trpc.tasks.delete.useMutation({
    onSuccess: () => {
      toast({ title: "Task deleted" });
      utils.tasks.list.invalidate();
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const allTasks = (tasksQuery.data || []) as Task[];
  const members = (profilesQuery.data || []) as Profile[];
  const allTeams = (teamsQuery.data || []) as Array<{ id: string; name: string; departmentId: string | null }>;
  const loading = tasksQuery.isLoading;

  // Filter tasks based on scope
  const tasks = allTasks.filter(task => {
    if (teamId) return task.teamId === teamId;
    if (departmentId) return task.departmentId === departmentId;
    return true;
  });

  // Functions within the department
  const functions = departmentId && !teamId
    ? allTeams.filter(t => t.departmentId === departmentId)
    : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization || !user) return;

    if (editingTask) {
      updateMutation.mutate({
        id: editingTask.id,
        title: formData.title,
        description: formData.description || undefined,
        status: formData.status,
        priority: formData.priority,
        dueDate: formData.dueDate || undefined,
        assignedTo: formData.assignedTo === 'none' ? undefined : formData.assignedTo || undefined,
      });
      toast({ title: "Task updated" });
      resetForm();
    } else {
      createMutation.mutate({
        title: formData.title,
        description: formData.description || undefined,
        priority: formData.priority,
        dueDate: formData.dueDate || undefined,
        assignedTo: formData.assignedTo === 'none' ? undefined : formData.assignedTo || undefined,
        teamId: teamId || (formData.teamId === 'none' ? undefined : formData.teamId || undefined),
        departmentId: departmentId || undefined,
      });
    }
  };

  const resetForm = () => {
    setDialogOpen(false);
    setEditingTask(null);
    setFormData(emptyForm);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate({ id });
  };

  const openEdit = (task: Task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      status: task.status || 'todo',
      priority: task.priority || 'medium',
      dueDate: task.dueDate || '',
      assignedTo: task.assignedTo || 'none',
      teamId: task.teamId || 'none',
    });
    setDialogOpen(true);
  };

  const quickStatusChange = (taskId: string, newStatus: string) => {
    updateMutation.mutate({ id: taskId, status: newStatus });
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
    const overStatus = KANBAN_COLUMNS.includes(over.id as keyof typeof STATUS_CONFIG)
      ? (over.id as string)
      : tasks.find(t => t.id === over.id)?.status;

    if (!overStatus) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === overStatus) return;

    updateMutation.mutate({ id: taskId, status: overStatus });
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
                      <AvatarImage src={task.assignee.avatarUrl || ''} />
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">{getInitials(task.assignee.fullName)}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground truncate max-w-[60px] hidden sm:block">
                      {task.assignee.fullName?.split(' ')[0]}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground/40">-</span>
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
                {task.dueDate ? (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(task.dueDate + 'T00:00:00'), 'MMM d')}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground/40">-</span>
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
        // KANBAN VIEW
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
            {/* Function tag selector */}
            {!teamId && functions.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Function tag</label>
                <Select value={formData.teamId} onValueChange={(v) => setFormData({ ...formData, teamId: v })}>
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
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Assignee</label>
                <Select value={formData.assignedTo} onValueChange={(v) => setFormData({ ...formData, assignedTo: v })}>
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {members.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.fullName}</SelectItem>
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
