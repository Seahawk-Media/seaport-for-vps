import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star } from "lucide-react";

interface Criterion {
  name: string;
  description: string;
}

interface CriterionScore {
  score: number;
  comments: string;
}

interface ReviewCriteriaFormProps {
  criteria: Criterion[];
  scores: Record<string, CriterionScore>;
  onScoresChange: (scores: Record<string, CriterionScore>) => void;
}

export function ReviewCriteriaForm({
  criteria,
  scores,
  onScoresChange,
}: ReviewCriteriaFormProps) {
  const updateScore = (criterionName: string, field: keyof CriterionScore, value: any) => {
    const newScores = {
      ...scores,
      [criterionName]: {
        ...scores[criterionName],
        [field]: value,
      },
    };
    onScoresChange(newScores);
  };

  const getRatingLabel = (score: number) => {
    switch (score) {
      case 1:
        return "Needs Improvement";
      case 2:
        return "Below Expectations";
      case 3:
        return "Meets Expectations";
      case 4:
        return "Exceeds Expectations";
      case 5:
        return "Outstanding";
      default:
        return "Not Rated";
    }
  };

  const getRatingColor = (score: number) => {
    switch (score) {
      case 1:
      case 2:
        return "destructive";
      case 3:
        return "secondary";
      case 4:
      case 5:
        return "default";
      default:
        return "outline";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Performance Criteria</h3>
        <p className="text-sm text-muted-foreground">Rate each criterion from 1-5</p>
      </div>

      <div className="space-y-4">
        {criteria.map((criterion) => {
          const score = scores[criterion.name] || { score: 3, comments: "" };
          
          return (
            <Card key={criterion.name}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{criterion.name}</CardTitle>
                    <CardDescription className="text-sm">
                      {criterion.description}
                    </CardDescription>
                  </div>
                  <Badge variant={getRatingColor(score.score)}>
                    {getRatingLabel(score.score)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Rating (1-5)</Label>
                  <div className="flex items-center space-x-2 mt-2">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        onClick={() => updateScore(criterion.name, "score", rating)}
                        className={`p-2 rounded-md transition-colors ${
                          score.score >= rating
                            ? "text-primary bg-primary/10"
                            : "text-muted-foreground hover:text-primary"
                        }`}
                      >
                        <Star
                          className={`h-5 w-5 ${
                            score.score >= rating ? "fill-current" : ""
                          }`}
                        />
                      </button>
                    ))}
                    <span className="ml-2 text-sm font-medium">
                      {score.score}/5
                    </span>
                  </div>
                </div>

                <div>
                  <Label htmlFor={`comments-${criterion.name}`} className="text-sm font-medium">
                    Comments
                  </Label>
                  <Textarea
                    id={`comments-${criterion.name}`}
                    value={score.comments}
                    onChange={(e) =>
                      updateScore(criterion.name, "comments", e.target.value)
                    }
                    placeholder={`Provide specific feedback on ${criterion.name.toLowerCase()}...`}
                    className="mt-1"
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}