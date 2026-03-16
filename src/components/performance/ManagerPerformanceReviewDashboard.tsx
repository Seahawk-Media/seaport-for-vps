import { useState } from "react";
import { trpc } from '@/lib/trpc';
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
  fullName: string;
  email: string;
  role: string;
  avatarUrl?: string;
  latestReview?: {
    id: string;
    reviewPeriod: string;
    status: string;
    rating?: number;
    createdAt: string;
  };
}

export function ManagerPerformanceReviewDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedEmployee, setSelectedEmployee] = useState<DirectReport | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  const { data: myProfile } = trpc.profiles.me.useQuery(undefined, {
    enabled: !!user,
  });

  const { data: allProfiles, isLoading: loading, refetch: refetchProfiles } = trpc.profiles.list.useQuery(undefined, {
    enabled: !!myProfile,
  });

  const { data: allReviews } = trpc.reviews.list.useQuery(undefined, {
    enabled: !!myProfile,
  });

  // Build direct reports from profiles where managerId matches current user's profile id
  const directReports: DirectReport[] = (allProfiles || [])
    .filter((p: any) => p.managerId === myProfile?.id && p.status === 'active')
    .map((report: any) => {
      const reviews = (allReviews || [])
        .filter((r: any) => r.employeeId === report.id)
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const latest = reviews[0];
      return {
        id: report.id,
        fullName: report.fullName || '',
        email: report.email || '',
        role: report.jobTitle || '',
        avatarUrl: report.avatarUrl,
        latestReview: latest ? {
          id: latest.id,
          reviewPeriod: latest.reviewPeriodStart && latest.reviewPeriodEnd
            ? `${latest.reviewPeriodStart} - ${latest.reviewPeriodEnd}`
            : 'N/A',
          status: latest.status || 'draft',
          rating: latest.overallRating,
          createdAt: latest.createdAt,
        } : undefined,
      };
    });

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
                      <CardTitle className="text-lg">{employee.fullName}</CardTitle>
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
                {employee.latestReview ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          Latest: {employee.latestReview.reviewPeriod}
                        </span>
                      </div>
                      <Badge variant={getStatusColor(employee.latestReview.status)}>
                        {employee.latestReview.status.replace("_", " ")}
                      </Badge>
                      {employee.latestReview.rating && (
                        <span className="text-sm font-medium">
                          Rating: {employee.latestReview.rating}/5
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(employee.latestReview.createdAt)}
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
            refetchProfiles();
          }}
        />
      )}
    </div>
  );
}
