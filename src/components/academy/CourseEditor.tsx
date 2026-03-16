import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, GripVertical, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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
  page_order: number;
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
  const [loading, setLoading] = useState(!!course);

  useEffect(() => {
    if (course) {
      fetchPages();
    }
  }, [course]);

  const fetchPages = async () => {
    if (!course) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('course_pages')
        .select('*')
        .eq('course_id', course.id)
        .order('page_order', { ascending: true });

      if (error) throw error;
      setPages(data || []);
    } catch (error) {
      console.error('Error fetching pages:', error);
      toast.error('Failed to load course pages');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPage = () => {
    setPages([
      ...pages,
      {
        title: `Page ${pages.length + 1}`,
        content: '',
        page_order: pages.length,
      },
    ]);
  };

  const handleRemovePage = (index: number) => {
    const newPages = pages.filter((_, i) => i !== index);
    // Reorder remaining pages
    setPages(newPages.map((p, i) => ({ ...p, page_order: i })));
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
        // Update existing course
        const { error } = await supabase
          .from('courses')
          .update({
            title: title.trim(),
            description: description.trim() || null,
            status,
          })
          .eq('id', courseId);

        if (error) throw error;
      } else {
        // Create new course
        const { data, error } = await supabase
          .from('courses')
          .insert({
            title: title.trim(),
            description: description.trim() || null,
            status,
            organization_id: organization.id,
            created_by: user.id,
          })
          .select()
          .single();

        if (error) throw error;
        courseId = data.id;
      }

      // Delete existing pages and recreate
      if (course) {
        await supabase.from('course_pages').delete().eq('course_id', courseId);
      }

      // Insert pages
      if (pages.length > 0) {
        const { error: pagesError } = await supabase.from('course_pages').insert(
          pages.map((page, index) => ({
            course_id: courseId,
            organization_id: organization.id,
            title: page.title,
            content: page.content,
            page_order: index,
          }))
        );

        if (pagesError) throw pagesError;
      }

      toast.success(course ? 'Course updated' : 'Course created');
      onClose();
    } catch (error) {
      console.error('Error saving course:', error);
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
