import { useState, useEffect } from "react";
import { trpc } from '@/lib/trpc';
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ReviewCriteriaForm } from "./ReviewCriteriaForm";
import { useToast } from "@/hooks/use-toast";
import { Save, Send } from "lucide-react";

interface Employee {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

interface ReviewTemplate {
  id: string;
  name: string;
  criteria: unknown;
}

interface PerformanceReviewModalProps {
  employee: Employee;
  isOpen: boolean;
  onClose: () => void;
}

export function PerformanceReviewModal({
  employee,
  isOpen,
  onClose,
}: PerformanceReviewModalProps) {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const { toast } = useToast();

  const [reviewPeriod, setReviewPeriod] = useState("");
  const [goals, setGoals] = useState("");
  const [feedback, setFeedback] = useState("");
  const [criteriaScores, setCriteriaScores] = useState<Record<string, { score: number; comments: string }>>({});
  const [reviewTemplate, setReviewTemplate] = useState<ReviewTemplate | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: templates } = trpc.reviews.listTemplates.useQuery(undefined, {
    enabled: isOpen,
  });

  const { data: myProfile } = trpc.profiles.me.useQuery(undefined, {
    enabled: isOpen && !!user,
  });

  const createReview = trpc.reviews.create.useMutation();

  useEffect(() => {
    if (isOpen && templates) {
      const defaultTemplate = templates.find((t: Record<string, unknown>) => t.isDefault);
      if (defaultTemplate) {
        setReviewTemplate(defaultTemplate);
        const initialScores: Record<string, { score: number; comments: string }> = {};
        const criteriaArray = Array.isArray(defaultTemplate.criteria)
          ? defaultTemplate.criteria
          : typeof defaultTemplate.criteria === 'string'
            ? JSON.parse(defaultTemplate.criteria)
            : [];
        criteriaArray.forEach((criterion: { name: string }) => {
          initialScores[criterion.name] = { score: 3, comments: "" };
        });
        setCriteriaScores(initialScores);
      }
      setDefaultReviewPeriod();
    }
  }, [isOpen, templates]);

  const setDefaultReviewPeriod = () => {
    const now = new Date();
    const month = now.toLocaleString("default", { month: "long" });
    const year = now.getFullYear();
    setReviewPeriod(`${month} ${year}`);
  };

  const calculateOverallRating = () => {
    const scores = Object.values(criteriaScores).map(c => c.score);
    if (scores.length === 0) return 0;
    return Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1));
  };

  const handleSave = async (status: "draft" | "completed") => {
    if (!user || !organization || !myProfile) return;

    setSaving(true);
    try {
      const overallRating = calculateOverallRating();

      await createReview.mutateAsync({
        employeeId: employee.id,
        reviewerId: myProfile.id,
        reviewPeriod,
        rating: overallRating,
        feedback,
        goals,
        status,
        organizationId: organization.id,
        criteriaScores,
        reviewTemplateId: reviewTemplate?.id,
      });

      toast({
        title: "Success",
        description: `Performance review ${status === "draft" ? "saved as draft" : "completed"} successfully`,
      });

      onClose();
    } catch {
      toast({
        title: "Error",
        description: "Failed to save performance review",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Performance Review</DialogTitle>
          <DialogDescription>
            Complete performance review for {employee.fullName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div>
              <h3 className="font-semibold">{employee.fullName}</h3>
              <p className="text-sm text-muted-foreground">{employee.role}</p>
            </div>
            <Badge variant="outline">
              Overall Rating: {calculateOverallRating()}/5
            </Badge>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="review-period">Review Period</Label>
              <Input
                id="review-period"
                value={reviewPeriod}
                onChange={(e) => setReviewPeriod(e.target.value)}
                placeholder="e.g., Q1 2024, January 2024"
              />
            </div>

            {reviewTemplate && (
              <ReviewCriteriaForm
                criteria={Array.isArray(reviewTemplate.criteria)
                  ? reviewTemplate.criteria
                  : typeof reviewTemplate.criteria === 'string'
                    ? JSON.parse(reviewTemplate.criteria)
                    : []}
                scores={criteriaScores}
                onScoresChange={setCriteriaScores}
              />
            )}

            <div>
              <Label htmlFor="feedback">Overall Feedback</Label>
              <Textarea
                id="feedback"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Provide comprehensive feedback on the employee's performance..."
                className="min-h-[100px]"
              />
            </div>

            <div>
              <Label htmlFor="goals">Goals for Next Period</Label>
              <Textarea
                id="goals"
                value={goals}
                onChange={(e) => setGoals(e.target.value)}
                placeholder="Set goals and expectations for the next review period..."
                className="min-h-[100px]"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSave("draft")}
              disabled={saving}
            >
              <Save className="h-4 w-4 mr-2" />
              Save Draft
            </Button>
            <Button
              onClick={() => handleSave("completed")}
              disabled={saving}
            >
              <Send className="h-4 w-4 mr-2" />
              Complete Review
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
