import { useState, useEffect } from 'react';
import { Plus, BookOpen, CheckCircle, Clock, Edit, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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
  created_at: string;
  page_count?: number;
  progress?: {
    current_page_order: number;
    completed_at: string | null;
  } | null;
}

export const AcademyDashboard = () => {
  const { organization } = useOrganization();
  const { isAdmin, isManager, loading: roleLoading } = useRole();
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [viewingCourse, setViewingCourse] = useState<Course | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Course | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);

  const canManage = isAdmin() || isManager();

  useEffect(() => {
    if (organization && user) {
      fetchProfile();
      fetchCourses();
    }
  }, [organization, user]);

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();
    if (data) {
      setProfileId(data.id);
    }
  };

  const fetchCourses = async () => {
    if (!organization) return;
    setLoading(true);

    try {
      // Fetch courses
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select('*')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false });

      if (coursesError) throw coursesError;

      // Fetch page counts for each course
      const coursesWithCounts = await Promise.all(
        (coursesData || []).map(async (course) => {
          const { count } = await supabase
            .from('course_pages')
            .select('*', { count: 'exact', head: true })
            .eq('course_id', course.id);

          // Fetch user's progress for this course
          let progress = null;
          if (profileId) {
            const { data: progressData } = await supabase
              .from('course_progress')
              .select('current_page_order, completed_at')
              .eq('course_id', course.id)
              .eq('profile_id', profileId)
              .single();
            progress = progressData;
          }

          return {
            ...course,
            page_count: count || 0,
            progress,
          };
        })
      );

      setCourses(coursesWithCounts);
    } catch (error) {
      console.error('Error fetching courses:', error);
      toast.error('Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

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

    try {
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', deleteConfirm.id);

      if (error) throw error;

      toast.success('Course deleted');
      fetchCourses();
    } catch (error) {
      console.error('Error deleting course:', error);
      toast.error('Failed to delete course');
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleStartCourse = (course: Course) => {
    setViewingCourse(course);
  };

  const handleEditorClose = () => {
    setShowEditor(false);
    setEditingCourse(null);
    fetchCourses();
  };

  const handleViewerClose = () => {
    setViewingCourse(null);
    fetchCourses();
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
    if (course.progress.completed_at) {
      return (
        <div className="flex items-center gap-1 text-green-600">
          <CheckCircle className="h-4 w-4" />
          <span className="text-sm">Completed</span>
        </div>
      );
    }
    if (course.page_count && course.page_count > 0) {
      const progress = Math.round(
        ((course.progress.current_page_order + 1) / course.page_count) * 100
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
                    <span>{course.page_count || 0} pages</span>
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
                        {course.progress?.completed_at
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
