import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Heart } from "lucide-react";

export default function CoreValuesPage() {
  return (
    <DashboardLayout title="Core Values" description="Track alignment with company values">
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <Heart className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Core Values</h3>
            <p className="text-muted-foreground">Track alignment with company values and provide feedback on value-driven behavior.</p>
          </div>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
