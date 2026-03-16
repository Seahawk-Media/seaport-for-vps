import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle, BookOpen } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useOrganization } from '@/hooks/useOrganization';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

interface CourseViewerProps {
  courseId: string;
  onClose: () => void;
}

export const CourseViewer = ({ courseId, onClose }: CourseViewerProps) => {
  const { organization } = useOrganization();
  const { user } = useAuth();
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  const { data: course, isLoading: courseLoading } = trpc.academy.getCourse.useQuery(
    { id: courseId },
    { enabled: !!user && !!organization }
  );

  const { data: pages = [], isLoading: pagesLoading } = trpc.academy.listPages.useQuery(
    { courseId },
    { enabled: !!user && !!organization }
  );

  const { data: progressData, isLoading: progressLoading } = trpc.academy.getProgress.useQuery(
    { courseId },
    { enabled: !!user && !!organization }
  );

  const updateProgressMutation = trpc.academy.updateProgress.useMutation();

  const loading = courseLoading || pagesLoading || progressLoading;

  // Sort pages by pageOrder
  const sortedPages = [...pages].sort((a: any, b: any) => (a.pageOrder ?? 0) - (b.pageOrder ?? 0));

  useEffect(() => {
    if (progressData) {
      if (progressData.completedAt) {
        setIsCompleted(true);
        setCurrentPageIndex(0);
      } else {
        setCurrentPageIndex(progressData.currentPageOrder || 0);
      }
    } else if (!progressLoading && user) {
      // Create initial progress record
      updateProgressMutation.mutate({ courseId, currentPageOrder: 0 });
    }
  }, [progressData, progressLoading]);

  const handleNext = () => {
    const nextIndex = currentPageIndex + 1;
    setCurrentPageIndex(nextIndex);
    updateProgressMutation.mutate({ courseId, currentPageOrder: nextIndex });
  };

  const handlePrevious = () => {
    setCurrentPageIndex(Math.max(0, currentPageIndex - 1));
  };

  const handleComplete = () => {
    updateProgressMutation.mutate(
      { courseId, currentPageOrder: sortedPages.length - 1 },
      {
        onSuccess: () => {
          toast.success('Course completed!');
          setIsCompleted(true);
        },
        onError: () => {
          toast.error('Failed to complete course');
        },
      }
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!course || sortedPages.length === 0) {
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

  const currentPage = sortedPages[currentPageIndex];
  const progress = ((currentPageIndex + 1) / sortedPages.length) * 100;
  const isLastPage = currentPageIndex === sortedPages.length - 1;

  if (isCompleted && !isLastPage) {
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
              Page {currentPageIndex + 1} of {sortedPages.length}
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
                disabled={updateProgressMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {updateProgressMutation.isPending ? (
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
