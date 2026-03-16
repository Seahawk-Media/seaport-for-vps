import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, Crown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from 'react-router-dom';

interface TeamsGridTabProps {
  departmentId: string;
}

interface Team {
  id: string;
  name: string;
  description: string | null;
  team_type: string | null;
  team_lead_id: string | null;
  team_lead?: { id: string; full_name: string; avatar_url: string | null } | null;
  member_count: number;
}

export const TeamsGridTab: React.FC<TeamsGridTabProps> = ({ departmentId }) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchTeams();
  }, [departmentId]);

  const fetchTeams = async () => {
    try {
      // Directly query teams by department_id
      const { data: teamsData, error } = await supabase
        .from('teams')
        .select('*, team_lead:profiles!teams_team_lead_id_fkey(id, full_name, avatar_url)')
        .eq('department_id', departmentId)
        .order('name');

      if (error) throw error;

      // Get member counts for all teams in one query
      const teamIds = (teamsData || []).map(t => t.id);
      const { data: memberships } = teamIds.length > 0
        ? await supabase.from('team_members').select('team_id').in('team_id', teamIds)
        : { data: [] };

      const memberCounts = new Map<string, number>();
      (memberships || []).forEach(m => {
        memberCounts.set(m.team_id, (memberCounts.get(m.team_id) || 0) + 1);
      });

      setTeams((teamsData || []).map(team => ({
        ...team,
        member_count: memberCounts.get(team.id) || 0,
      })));
    } catch (error) {
      console.error('Error fetching teams:', error);
    } finally {
      setLoading(false);
    }
  };

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
                      <Badge className={getTypeColor(team.team_type)}>
                        {team.team_type || 'project'}
                      </Badge>
                      <Badge variant="secondary">
                        {team.member_count} members
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
                {team.team_lead && (
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={team.team_lead.avatar_url || ''} />
                      <AvatarFallback className="text-xs">{getInitials(team.team_lead.full_name)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-muted-foreground">{team.team_lead.full_name}</span>
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
