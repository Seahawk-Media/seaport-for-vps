import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, User } from "lucide-react";
import { PerformanceReviewModal } from "./PerformanceReviewModal";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/ui/empty-state";

interface DirectReport {
  id: string;
  full_name: string;
  email: string;
  role: string;
  avatar_url?: string;
  latest_review?: {
    id: string;
    review_period: string;
    status: string;
    rating?: number;
    created_at: string;
  };
}

export function ManagerPerformanceReviewDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [directReports, setDirectReports] = useState<DirectReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<DirectReport | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchDirectReports();
    }
  }, [user]);

  const fetchDirectReports = async () => {
    try {
      // First get the manager's profile ID
      const { data: managerProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user?.id)
        .single();

      if (!managerProfile) return;

      // Get direct reports with their latest review
      const { data: reports } = await supabase
        .from("profiles")
        .select(`
          id,
          full_name,
          email,
          job_title,
          avatar_url,
          performance_reviews:performance_reviews!performance_reviews_employee_id_fkey (
            id,
            review_period_start,
            review_period_end,
            status,
            overall_rating,
            created_at
          )
        `)
        .eq("manager_id", managerProfile.id)
        .eq("status", "active");

      if (reports) {
        const reportsWithLatestReview = reports.map(report => ({
          id: report.id,
          full_name: report.full_name || '',
          email: report.email || '',
          role: report.job_title || '',
          avatar_url: report.avatar_url,
          latest_review: report.performance_reviews?.length > 0 
            ? (() => {
                const sorted = report.performance_reviews.sort((a: any, b: any) => 
                  new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                );
                const latest = sorted[0];
                return {
                  id: latest.id,
                  review_period: latest.review_period_start && latest.review_period_end 
                    ? `${latest.review_period_start} - ${latest.review_period_end}`
                    : 'N/A',
                  status: latest.status || 'draft',
                  rating: latest.overall_rating,
                  created_at: latest.created_at
                };
              })()
            : undefined
        }));

        setDirectReports(reportsWithLatestReview);
      }
    } catch (error) {
      console.error("Error fetching direct reports:", error);
      toast({
        title: "Error",
        description: "Failed to load direct reports",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStartReview = (employee: DirectReport) => {
    setSelectedEmployee(employee);
    setIsReviewModalOpen(true);
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "completed":
        return "default";
      case "in_progress":
        return "secondary";
      case "draft":
        return "outline";
      default:
        return "destructive";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-1/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Performance Review Pipeline</h1>
          <p className="text-muted-foreground">
            Manage performance reviews for your direct reports
          </p>
        </div>
      </div>

      {directReports.length === 0 ? (
        <EmptyState icon={User} title="No direct reports yet." description="You don't have any direct reports assigned to you yet." />
      ) : (
        <div className="grid gap-4">
          {directReports.map((employee) => (
            <Card key={employee.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{employee.full_name}</CardTitle>
                      <CardDescription>{employee.role}</CardDescription>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleStartReview(employee)}
                    size="sm"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    New Review
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {employee.latest_review ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          Latest: {employee.latest_review.review_period}
                        </span>
                      </div>
                      <Badge variant={getStatusColor(employee.latest_review.status)}>
                        {employee.latest_review.status.replace("_", " ")}
                      </Badge>
                      {employee.latest_review.rating && (
                        <span className="text-sm font-medium">
                          Rating: {employee.latest_review.rating}/5
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(employee.latest_review.created_at)}
                    </span>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    No reviews completed yet
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isReviewModalOpen && selectedEmployee && (
        <PerformanceReviewModal
          employee={selectedEmployee}
          isOpen={isReviewModalOpen}
          onClose={() => {
            setIsReviewModalOpen(false);
            setSelectedEmployee(null);
            fetchDirectReports(); // Refresh the list
          }}
        />
      )}
    </div>
  );
}