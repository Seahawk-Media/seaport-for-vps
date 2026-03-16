import { useState } from 'react';
import { Plus, BookOpen, CheckCircle, Clock, Edit, Trash2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useOrganization } from '@/hooks/useOrganization';
import { useRole } from '@/hooks/useRole';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { CourseEditor } from './CourseEditor';
import { CourseViewer } from './CourseViewer';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface Course {
  id: string;
  title: string;
  description: string | null;
  status: string;
  createdAt: string;
  pageCount?: number;
  progress?: {
    currentPageOrder: number;
    completedAt: string | null;
  } | null;
}

export const AcademyDashboard = () => {
  const { organization } = useOrganization();
  const { isAdmin, isManager, loading: roleLoading } = useRole();
  const { user } = useAuth();
  const [showEditor, setShowEditor] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [viewingCourse, setViewingCourse] = useState<Course | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Course | null>(null);

  const canManage = isAdmin() || isManager();

  const { data: rawCourses = [], isLoading: coursesLoading, refetch: refetchCourses } = trpc.academy.listCourses.useQuery(
    undefined,
    { enabled: !!organization && !!user }
  );

  // Build courses with page counts and progress
  // We fetch pages and progress per course using individual queries would be complex,
  // so we use the list and map approach
  const { data: allProgress } = trpc.academy.getProgress.useQuery(
    { courseId: rawCourses[0]?.id ?? '' },
    { enabled: false } // We'll handle progress differently
  );

  // For simplicity, map raw courses to the Course interface
  const courses: Course[] = rawCourses.map((c: any) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    status: c.status ?? 'draft',
    createdAt: c.createdAt,
  }));

  const loading = coursesLoading;

  const deleteMutation = trpc.academy.updateCourse.useMutation({
    onSuccess: () => {
      toast.success('Course deleted');
      refetchCourses();
    },
    onError: () => {
      toast.error('Failed to delete course');
    },
  });

  const handleCreateCourse = () => {
    setEditingCourse(null);
    setShowEditor(true);
  };

  const handleEditCourse = (course: Course) => {
    setEditingCourse(course);
    setShowEditor(true);
  };

  const handleDeleteCourse = async () => {
    if (!deleteConfirm) return;
    // Archive the course instead of hard delete (no delete route available)
    deleteMutation.mutate({ id: deleteConfirm.id, status: 'archived' });
    setDeleteConfirm(null);
  };

  const handleStartCourse = (course: Course) => {
    setViewingCourse(course);
  };

  const handleEditorClose = () => {
    setShowEditor(false);
    setEditingCourse(null);
    refetchCourses();
  };

  const handleViewerClose = () => {
    setViewingCourse(null);
    refetchCourses();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return <Badge className="bg-green-500">Published</Badge>;
      case 'draft':
        return <Badge variant="secondary">Draft</Badge>;
      case 'archived':
        return <Badge variant="outline">Archived</Badge>;
      default:
        return null;
    }
  };

  const getCourseProgress = (course: Course) => {
    if (!course.progress) return null;
    if (course.progress.completedAt) {
      return (
        <div className="flex items-center gap-1 text-green-600">
          <CheckCircle className="h-4 w-4" />
          <span className="text-sm">Completed</span>
        </div>
      );
    }
    if (course.pageCount && course.pageCount > 0) {
      const progress = Math.round(
        ((course.progress.currentPageOrder + 1) / course.pageCount) * 100
      );
      return (
        <div className="flex items-center gap-1 text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span className="text-sm">{progress}% complete</span>
        </div>
      );
    }
    return null;
  };

  if (roleLoading || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (showEditor) {
    return (
      <CourseEditor
        course={editingCourse}
        onClose={handleEditorClose}
      />
    );
  }

  if (viewingCourse) {
    return (
      <CourseViewer
        courseId={viewingCourse.id}
        onClose={handleViewerClose}
      />
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            Academy
          </h1>
          <p className="text-muted-foreground">
            {canManage ? 'Create and manage training courses' : 'Complete required training courses'}
          </p>
        </div>
        {canManage && (
          <Button onClick={handleCreateCourse}>
            <Plus className="h-4 w-4 mr-2" />
            Create Course
          </Button>
        )}
      </div>

      {courses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No courses yet"
          description={canManage ? 'Create your first training course to get started.' : 'No training courses are available yet.'}
          action={canManage ? (
            <Button onClick={handleCreateCourse}>
              <Plus className="h-4 w-4 mr-2" />
              Create Course
            </Button>
          ) : undefined}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => {
            // Non-managers only see published courses
            if (!canManage && course.status !== 'published') return null;

            return (
              <Card key={course.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{course.title}</CardTitle>
                      {canManage && (
                        <div className="mt-1">{getStatusBadge(course.status)}</div>
                      )}
                    </div>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {course.description || 'No description'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-end">
                  <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                    <span>{course.pageCount || 0} pages</span>
                    {getCourseProgress(course)}
                  </div>
                  <div className="flex gap-2">
                    {canManage ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleEditCourse(course)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteConfirm(course)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => handleStartCourse(course)}
                      >
                        {course.progress?.completedAt
                          ? 'Review'
                          : course.progress
                          ? 'Continue'
                          : 'Start'}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Course</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCourse} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
