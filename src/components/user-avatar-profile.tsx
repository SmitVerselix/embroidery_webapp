'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/providers/auth-provider';
import { cn } from '@/lib/utils';

interface UserAvatarProfileProps {
  className?: string;
  showInfo?: boolean;
}

export function UserAvatarProfile({ className, showInfo }: UserAvatarProfileProps) {
  const { user } = useAuth();

  if (!user) {
    return (
      <Avatar className={cn('h-8 w-8', className)}>
        <AvatarFallback>?</AvatarFallback>
      </Avatar>
    );
  }

  const initials = user.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user.email?.[0]?.toUpperCase() || 'U';

  return (
    <div className='flex items-center gap-2'>
      <Avatar className={cn('h-8 w-8', className)}>
        <AvatarImage
          src={user.profileImage || undefined}
          alt={user.name || user.email}
        />
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      {showInfo && (
        <div className='grid flex-1 text-left text-sm leading-tight'>
          <span className='truncate font-semibold'>{user.name}</span>
          <span className='truncate text-xs'>{user.email}</span>
        </div>
      )}
    </div>
  );
}

export default UserAvatarProfile;