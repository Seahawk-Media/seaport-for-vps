import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity, LogIn, Eye, MousePointer, RefreshCw, Search } from 'lucide-react';
import { format } from 'date-fns';

interface ActivityLog {
  id: string;
  profile_id: string;
  activity_type: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  page_path: string | null;
  user_agent: string | null;
  created_at: string;
  profiles: {
    full_name: string | null;
    email: string | null;
  } | null;
}

const activityTypeConfig: Record<string, { label: string; icon: React.ReactNode; variant: 'default' | 'secondary' | 'outline' }> = {
  login: { label: 'Login', icon: <LogIn className="h-3 w-3" />, variant: 'default' },
  logout: { label: 'Logout', icon: <LogIn className="h-3 w-3" />, variant: 'secondary' },
  page_view: { label: 'Page View', icon: <Eye className="h-3 w-3" />, variant: 'outline' },
  action: { label: 'Action', icon: <MousePointer className="h-3 w-3" />, variant: 'secondary' },
};

export const ActivityLogViewer: React.FC = () => {
  const { organization } = useOrganization();
  const [activityFilter, setActivityFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ['activity-logs', organization?.id, activityFilter],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      let query = supabase
        .from('activity_logs')
        .select(`
          id,
          profile_id,
          activity_type,
          description,
          metadata,
          page_path,
          user_agent,
          created_at,
          profiles!activity_logs_profile_id_fkey (
            full_name,
            email
          )
        `)
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false })
        .limit(200);

      if (activityFilter !== 'all') {
        query = query.eq('activity_type', activityFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ActivityLog[];
    },
    enabled: !!organization?.id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: users } = useQuery({
    queryKey: ['org-users', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('organization_id', organization.id);
      if (error) throw error;
      return data;
    },
    enabled: !!organization?.id,
  });

  const filteredLogs = logs?.filter(log => {
    const matchesUser = userFilter === 'all' || !userFilter || log.profile_id === userFilter;
    const matchesSearch = !searchQuery || 
      log.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.page_path?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.profiles?.email?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesUser && matchesSearch;
  }) || [];

  const getActivityBadge = (type: string) => {
    const config = activityTypeConfig[type] || { label: type, icon: <Activity className="h-3 w-3" />, variant: 'outline' as const };
    return (
      <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const parseUserAgent = (ua: string | null) => {
    if (!ua) return 'Unknown';
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    return 'Other';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Activity Log
            </CardTitle>
            <CardDescription>
              Monitor user login and browsing activities across your organization
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search activities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64"
            />
          </div>
          <Select value={activityFilter} onValueChange={setActivityFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Activity Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Activities</SelectItem>
              <SelectItem value="login">Logins</SelectItem>
              <SelectItem value="logout">Logouts</SelectItem>
              <SelectItem value="page_view">Page Views</SelectItem>
              <SelectItem value="action">Actions</SelectItem>
            </SelectContent>
          </Select>
          <Select value={userFilter} onValueChange={setUserFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Users" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              {users?.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.full_name || user.email || 'Unknown'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Activity Table */}
        <ScrollArea className="h-[500px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No activity logs found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Activity</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Page</TableHead>
                  <TableHead>Browser</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {format(new Date(log.created_at), 'MMM d, HH:mm:ss')}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">
                          {log.profiles?.full_name || 'Unknown'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {log.profiles?.email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{getActivityBadge(log.activity_type)}</TableCell>
                    <TableCell className="max-w-48 truncate text-sm">
                      {log.description || '-'}
                    </TableCell>
                    <TableCell className="text-sm font-mono text-muted-foreground">
                      {log.page_path || '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {parseUserAgent(log.user_agent)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>

        {/* Stats */}
        {logs && logs.length > 0 && (
          <div className="mt-4 pt-4 border-t flex gap-6 text-sm text-muted-foreground">
            <span>Total: {filteredLogs.length} activities</span>
            <span>Logins: {logs.filter(l => l.activity_type === 'login').length}</span>
            <span>Page Views: {logs.filter(l => l.activity_type === 'page_view').length}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
