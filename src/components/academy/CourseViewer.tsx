import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle, BookOpen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

interface CoursePage {
  id: string;
  title: string;
  content: string;
  page_order: number;
}

interface CourseViewerProps {
  courseId: string;
  onClose: () => void;
}

export const CourseViewer = ({ courseId, onClose }: CourseViewerProps) => {
  const { organization } = useOrganization();
  const { user } = useAuth();
  const [course, setCourse] = useState<{ title: string; description: string | null } | null>(null);
  const [pages, setPages] = useState<CoursePage[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    fetchData();
  }, [courseId, user]);

  const fetchData = async () => {
    if (!user || !organization) return;
    setLoading(true);

    try {
      // Get profile ID
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profileData) throw new Error('Profile not found');
      setProfileId(profileData.id);

      // Fetch course
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('title, description')
        .eq('id', courseId)
        .single();

      if (courseError) throw courseError;
      setCourse(courseData);

      // Fetch pages
      const { data: pagesData, error: pagesError } = await supabase
        .from('course_pages')
        .select('*')
        .eq('course_id', courseId)
        .order('page_order', { ascending: true });

      if (pagesError) throw pagesError;
      setPages(pagesData || []);

      // Fetch or create progress
      const { data: progressData } = await supabase
        .from('course_progress')
        .select('current_page_order, completed_at')
        .eq('course_id', courseId)
        .eq('profile_id', profileData.id)
        .single();

      if (progressData) {
        if (progressData.completed_at) {
          setIsCompleted(true);
          setCurrentPageIndex(0);
        } else {
          setCurrentPageIndex(progressData.current_page_order || 0);
        }
      } else {
        // Create initial progress record
        await supabase.from('course_progress').insert({
          course_id: courseId,
          profile_id: profileData.id,
          organization_id: organization.id,
          current_page_order: 0,
        });
      }
    } catch (error) {
      console.error('Error fetching course:', error);
      toast.error('Failed to load course');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async () => {
    if (!profileId) return;

    const nextIndex = currentPageIndex + 1;
    setCurrentPageIndex(nextIndex);

    // Update progress
    try {
      await supabase
        .from('course_progress')
        .update({ current_page_order: nextIndex })
        .eq('course_id', courseId)
        .eq('profile_id', profileId);
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  };

  const handlePrevious = () => {
    setCurrentPageIndex(Math.max(0, currentPageIndex - 1));
  };

  const handleComplete = async () => {
    if (!profileId) return;
    setCompleting(true);

    try {
      await supabase
        .from('course_progress')
        .update({
          completed_at: new Date().toISOString(),
          current_page_order: pages.length - 1,
        })
        .eq('course_id', courseId)
        .eq('profile_id', profileId);

      toast.success('Course completed!');
      setIsCompleted(true);
    } catch (error) {
      console.error('Error completing course:', error);
      toast.error('Failed to complete course');
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!course || pages.length === 0) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={onClose} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Academy
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">This course has no content yet.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentPage = pages[currentPageIndex];
  const progress = ((currentPageIndex + 1) / pages.length) * 100;
  const isLastPage = currentPageIndex === pages.length - 1;

  if (isCompleted && !isLastPage) {
    // Show completion screen for already completed courses
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={onClose} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Academy
        </Button>
        <Card className="max-w-2xl mx-auto">
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Course Already Completed</h2>
            <p className="text-muted-foreground mb-6">
              You have already completed "{course.title}".
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => { setCurrentPageIndex(0); setIsCompleted(false); }}>
                Review Course
              </Button>
              <Button onClick={onClose}>
                Back to Academy
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">{course.title}</h1>
            <p className="text-sm text-muted-foreground">
              Page {currentPageIndex + 1} of {pages.length}
            </p>
          </div>
        </div>

        <Progress value={progress} className="mb-6" />

        <Card>
          <CardHeader>
            <CardTitle>{currentPage.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              <p className="whitespace-pre-wrap">{currentPage.content}</p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between border-t pt-4">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentPageIndex === 0}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>

            {isLastPage ? (
              <Button
                onClick={handleComplete}
                disabled={completing}
                className="bg-green-600 hover:bg-green-700"
              >
                {completing ? (
                  'Completing...'
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Complete Course
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={handleNext}>
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};
