import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, GripVertical, Save } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useOrganization } from '@/hooks/useOrganization';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface Course {
  id: string;
  title: string;
  description: string | null;
  status: string;
}

interface CoursePage {
  id?: string;
  title: string;
  content: string;
  pageOrder: number;
}

interface CourseEditorProps {
  course: Course | null;
  onClose: () => void;
}

export const CourseEditor = ({ course, onClose }: CourseEditorProps) => {
  const { organization } = useOrganization();
  const { user } = useAuth();
  const [title, setTitle] = useState(course?.title || '');
  const [description, setDescription] = useState(course?.description || '');
  const [status, setStatus] = useState(course?.status || 'draft');
  const [pages, setPages] = useState<CoursePage[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: existingPages, isLoading: loading } = trpc.academy.listPages.useQuery(
    { courseId: course?.id ?? '' },
    { enabled: !!course }
  );

  const createCourseMutation = trpc.academy.createCourse.useMutation();
  const updateCourseMutation = trpc.academy.updateCourse.useMutation();
  const createPageMutation = trpc.academy.createPage.useMutation();

  useEffect(() => {
    if (existingPages) {
      const sorted = [...existingPages].sort((a, b) => ((a as Record<string, unknown>).pageOrder as number ?? 0) - ((b as Record<string, unknown>).pageOrder as number ?? 0));
      setPages(sorted.map((p) => ({
        id: p.id,
        title: p.title,
        content: p.content || '',
        pageOrder: p.pageOrder ?? 0,
      })));
    }
  }, [existingPages]);

  const handleAddPage = () => {
    setPages([
      ...pages,
      {
        title: `Page ${pages.length + 1}`,
        content: '',
        pageOrder: pages.length,
      },
    ]);
  };

  const handleRemovePage = (index: number) => {
    const newPages = pages.filter((_, i) => i !== index);
    setPages(newPages.map((p, i) => ({ ...p, pageOrder: i })));
  };

  const handlePageChange = (index: number, field: 'title' | 'content', value: string) => {
    const newPages = [...pages];
    newPages[index] = { ...newPages[index], [field]: value };
    setPages(newPages);
  };

  const handleSave = async () => {
    if (!organization || !user) return;
    if (!title.trim()) {
      toast.error('Please enter a course title');
      return;
    }

    setSaving(true);

    try {
      let courseId = course?.id;

      if (courseId) {
        await updateCourseMutation.mutateAsync({
          id: courseId,
          title: title.trim(),
          description: description.trim() || undefined,
          status: status as 'draft' | 'published' | 'archived',
        });
      } else {
        const newCourse = await createCourseMutation.mutateAsync({
          title: title.trim(),
          description: description.trim() || undefined,
        });
        courseId = newCourse.id;
      }

      // Create pages (the backend createPage adds one at a time)
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        await createPageMutation.mutateAsync({
          courseId: courseId!,
          title: page.title,
          content: page.content,
          pageOrder: i,
        });
      }

      toast.success(course ? 'Course updated' : 'Course created');
      onClose();
    } catch {
      toast.error('Failed to save course');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">
            {course ? 'Edit Course' : 'Create Course'}
          </h1>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Course'}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Course Details */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Course Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter course title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter course description"
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Course Pages */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Course Pages</CardTitle>
            <Button size="sm" onClick={handleAddPage}>
              <Plus className="h-4 w-4 mr-1" />
              Add Page
            </Button>
          </CardHeader>
          <CardContent>
            {pages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No pages yet. Add pages to build your course content.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pages.map((page, index) => (
                  <div
                    key={index}
                    className="border rounded-lg p-4 bg-card"
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-muted-foreground mt-2">
                        <GripVertical className="h-5 w-5" />
                      </div>
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-muted-foreground">
                            Page {index + 1}
                          </span>
                          <Input
                            value={page.title}
                            onChange={(e) => handlePageChange(index, 'title', e.target.value)}
                            placeholder="Page title"
                            className="flex-1"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemovePage(index)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                        <Textarea
                          value={page.content}
                          onChange={(e) => handlePageChange(index, 'content', e.target.value)}
                          placeholder="Enter page content..."
                          rows={4}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
