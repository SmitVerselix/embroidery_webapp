'use client';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { navItems } from '@/config/nav-config';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useAuth } from '@/providers/auth-provider';
import { useFilteredNavItems } from '@/hooks/use-nav';
import {
  IconBell,
  IconChevronRight,
  IconChevronsDown,
  IconCreditCard,
  IconLogout,
  IconUserCircle,
  IconDashboard,
  IconPackage,
  IconLayoutKanban,
  IconFolder,
  IconReceipt,
  IconUser,
  IconStar,
  IconSettings,
  IconHome,
  IconUsers
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';
import { CompanySwitcher } from './company-switcher';

// =============================================================================
// ICON MAP - Map icon names to actual icon components
// =============================================================================

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: IconDashboard,
  product: IconPackage,
  kanban: IconLayoutKanban,
  folder: IconFolder,
  billing: IconReceipt,
  user: IconUser,
  star: IconStar,
  settings: IconSettings,
  home: IconHome,
  users: IconUsers,
  orders: IconReceipt
};

// Default icon if not found
const DefaultIcon = IconDashboard;

// =============================================================================
// USER AVATAR COMPONENT
// =============================================================================

interface UserAvatarProps {
  className?: string;
  showInfo?: boolean;
}

function UserAvatar({ className, showInfo }: UserAvatarProps) {
  const { user } = useAuth();

  if (!user) return null;

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
      <Avatar className={className || 'h-8 w-8'}>
        <AvatarImage
          src={user.profileImage || undefined}
          alt={user.name || user.email}
        />
        <AvatarFallback className='rounded-lg'>{initials}</AvatarFallback>
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

// =============================================================================
// APP SIDEBAR COMPONENT
// =============================================================================

export default function AppSidebar() {
  const pathname = usePathname();
  const { isOpen } = useMediaQuery();
  const { user, currentCompany, logout } = useAuth();
  const router = useRouter();
  const filteredItems = useFilteredNavItems(navItems);
  const { state } = useSidebar();

  // Get company ID for building URLs
  const companyId = currentCompany?.company?.id;

  React.useEffect(() => {
    // Side effects based on sidebar state changes
  }, [isOpen]);

  const handleLogout = async () => {
    await logout();
  };

  // Build URL with company ID
  const buildUrl = (url: string) => {
    if (!companyId) return url;
    return url.replace('[companyId]', companyId);
  };

  // Get icon component from icon name
  const getIcon = (iconName?: string) => {
    if (!iconName) return DefaultIcon;
    return iconMap[iconName] || DefaultIcon;
  };

  const isCollapsed = state === 'collapsed';

  return (
    <Sidebar collapsible='icon'>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <CompanySwitcher />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className='overflow-x-hidden'>
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarMenu>
            {filteredItems.map((item) => {
              const Icon = getIcon(item.icon);
              const hasSubItems = item?.items && item?.items?.length > 0;

              // When sidebar is collapsed, render all items as direct links
              // (even those with sub-items) so they remain clickable
              if (hasSubItems && isCollapsed) {
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      isActive={pathname === item.url}
                    >
                      <Link href={item.url}>
                        <Icon className='size-4' />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              }

              return hasSubItems ? (
                <Collapsible
                  key={item.title}
                  asChild
                  defaultOpen={item.isActive}
                  className='group/collapsible'
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        tooltip={item.title}
                        isActive={pathname === item.url}
                      >
                        <Icon className='size-4' />
                        <span>{item.title}</span>
                        <IconChevronRight className='ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90' />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {item.items?.map((subItem) => (
                          <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={pathname === subItem.url}
                            >
                              <Link href={subItem.url}>
                                <span>{subItem.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              ) : (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.title}
                    isActive={pathname === item.url}
                  >
                    <Link href={item.url}>
                      <Icon className='size-4' />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size='lg'
                  className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
                >
                  <UserAvatar className='h-8 w-8 rounded-lg' showInfo />
                  <IconChevronsDown className='ml-auto size-4' />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className='w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg'
                side='bottom'
                align='end'
                sideOffset={4}
              >
                <DropdownMenuLabel className='p-0 font-normal'>
                  <div className='px-1 py-1.5'>
                    <UserAvatar className='h-8 w-8 rounded-lg' showInfo />
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                <DropdownMenuGroup>
                  <DropdownMenuItem
                    onClick={() =>
                      router.push(buildUrl('/dashboard/[companyId]/profile'))
                    }
                    className='cursor-pointer'
                  >
                    <IconUserCircle className='mr-2 h-4 w-4' />
                    Profile
                  </DropdownMenuItem>
                  {currentCompany && (
                    <DropdownMenuItem
                      onClick={() =>
                        router.push(buildUrl('/dashboard/[companyId]/billing'))
                      }
                      className='cursor-pointer'
                    >
                      <IconCreditCard className='mr-2 h-4 w-4' />
                      Billing
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem className='cursor-pointer'>
                    <IconBell className='mr-2 h-4 w-4' />
                    Notifications
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className='cursor-pointer text-red-600 focus:text-red-600'
                >
                  <IconLogout className='mr-2 h-4 w-4' />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
