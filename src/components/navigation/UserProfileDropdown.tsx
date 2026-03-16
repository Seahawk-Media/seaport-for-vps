import { useState, useEffect } from 'react';
import { User, Settings, LogOut, Bookmark, Building2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface UserProfile {
  id: string;
  full_name: string;
  avatar_url?: string;
}

interface UserProfileDropdownProps {
  onMyJourneyClick: () => void;
  onSettingsClick: () => void;
  onAdminSettingsClick?: () => void;
  onSignOut: () => void;
}

export const UserProfileDropdown = ({
  onMyJourneyClick,
  onSettingsClick,
  onAdminSettingsClick,
  onSignOut
}: UserProfileDropdownProps) => {
  const { user } = useAuth();
  const { isAdmin, isSuperAdmin } = useRole();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .eq('user_id', user.id)
      .single();

    if (profile) {
      setProfile(profile);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (!user || !profile) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 p-1 rounded-full hover:bg-accent transition-colors">
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
              {getInitials(profile.full_name)}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {getInitials(profile.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-medium">{profile.full_name}</span>
            <span className="text-xs text-muted-foreground">{user.email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onMyJourneyClick}>
          <Bookmark className="mr-2 h-4 w-4" />
          My Journey
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onSettingsClick}>
          <User className="mr-2 h-4 w-4" />
          Profile
        </DropdownMenuItem>
        {(isAdmin() || isSuperAdmin()) && onAdminSettingsClick && (
          <DropdownMenuItem onClick={onAdminSettingsClick}>
            <Building2 className="mr-2 h-4 w-4" />
            Org
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};