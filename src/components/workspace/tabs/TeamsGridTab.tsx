import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, Crown, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useNavigate } from 'react-router-dom';

interface TeamsGridTabProps {
  departmentId: string;
}

interface Team {
  id: string;
  name: string;
  description: string | null;
  teamType: string | null;
  teamLeadId: string | null;
  teamLead?: { id: string; fullName: string; avatarUrl: string | null } | null;
  memberCount: number;
}

export const TeamsGridTab: React.FC<TeamsGridTabProps> = ({ departmentId }) => {
  const navigate = useNavigate();

  const teamsQuery = trpc.teams.list.useQuery();
  const teamMembersQuery = trpc.teamMembers.list.useQuery({ teamId: departmentId });

  const allTeams = (teamsQuery.data || []) as Array<{ id: string; name: string; description: string | null; teamType: string | null; teamLeadId: string | null; teamLead?: { id: string; fullName: string; avatarUrl: string | null } | null; departmentId: string | null }>;
  const loading = teamsQuery.isLoading;

  // Filter teams by department and enrich with member counts
  const teams: Team[] = allTeams
    .filter((t) => t.departmentId === departmentId)
    .map((t) => ({
      ...t,
      memberCount: 0, // TODO: enrich with actual member counts from teamMembers query
    }));

  const getInitials = (name: string) => name?.split(' ').map(n => n[0]).join('').toUpperCase() || '??';

  const getTypeColor = (type: string | null) => {
    const colors: Record<string, string> = {
      'project': 'bg-blue-100 text-blue-800',
      'functional': 'bg-green-100 text-green-800',
      'cross-functional': 'bg-purple-100 text-purple-800',
    };
    return colors[type || 'project'] || colors['project'];
  };

  if (loading) {
    return <div className="flex items-center justify-center h-48 text-muted-foreground">Loading teams...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Functions</h2>
        <p className="text-sm text-muted-foreground">Functions within this department</p>
      </div>

      {teams.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No functions in this department yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => (
            <Card
              key={team.id}
              className="hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => navigate(`/function/${team.id}`)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      {team.name}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge className={getTypeColor(team.teamType)}>
                        {team.teamType || 'project'}
                      </Badge>
                      <Badge variant="secondary">
                        {team.memberCount} members
                      </Badge>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </CardHeader>
              <CardContent>
                {team.description && (
                  <CardDescription className="mb-3 line-clamp-2">{team.description}</CardDescription>
                )}
                {team.teamLead && (
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={team.teamLead.avatarUrl || ''} />
                      <AvatarFallback className="text-xs">{getInitials(team.teamLead.fullName)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-muted-foreground">{team.teamLead.fullName}</span>
                    <Crown className="h-4 w-4 text-yellow-500" />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
