import React, { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
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

  const { data: logs, isLoading, refetch } = trpc.activity.list.useQuery(
    { limit: 100 },
    {
      enabled: !!organization?.id,
      refetchInterval: 30000,
    }
  );

  const { data: profiles } = trpc.profiles.list.useQuery(undefined, {
    enabled: !!organization?.id,
  });

  // Build a lookup map from profileId to profile info
  const profileMap = useMemo(() => {
    const map = new Map<string, { fullName: string | null; email: string | null }>();
    for (const p of profiles ?? []) {
      map.set(p.id, { fullName: p.fullName, email: p.email });
    }
    return map;
  }, [profiles]);

  const filteredLogs = useMemo(() => {
    let result = logs ?? [];

    if (activityFilter !== 'all') {
      result = result.filter(log => log.activityType === activityFilter);
    }

    if (userFilter && userFilter !== 'all') {
      result = result.filter(log => log.profileId === userFilter);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(log => {
        const profile = log.profileId ? profileMap.get(log.profileId) : null;
        return (
          log.description?.toLowerCase().includes(q) ||
          log.pagePath?.toLowerCase().includes(q) ||
          profile?.fullName?.toLowerCase().includes(q) ||
          profile?.email?.toLowerCase().includes(q)
        );
      });
    }

    return result;
  }, [logs, activityFilter, userFilter, searchQuery, profileMap]);

  const getActivityBadge = (type: string | null) => {
    const config = activityTypeConfig[type ?? ''] || { label: type ?? 'unknown', icon: <Activity className="h-3 w-3" />, variant: 'outline' as const };
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
              {profiles?.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.fullName || user.email || 'Unknown'}
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
                {filteredLogs.map((log) => {
                  const profile = log.profileId ? profileMap.get(log.profileId) : null;
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {format(new Date(log.createdAt), 'MMM d, HH:mm:ss')}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">
                            {profile?.fullName || 'Unknown'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {profile?.email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{getActivityBadge(log.activityType)}</TableCell>
                      <TableCell className="max-w-48 truncate text-sm">
                        {log.description || '-'}
                      </TableCell>
                      <TableCell className="text-sm font-mono text-muted-foreground">
                        {log.pagePath || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {parseUserAgent(log.userAgent)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </ScrollArea>

        {/* Stats */}
        {logs && logs.length > 0 && (
          <div className="mt-4 pt-4 border-t flex gap-6 text-sm text-muted-foreground">
            <span>Total: {filteredLogs.length} activities</span>
            <span>Logins: {logs.filter(l => l.activityType === 'login').length}</span>
            <span>Page Views: {logs.filter(l => l.activityType === 'page_view').length}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
