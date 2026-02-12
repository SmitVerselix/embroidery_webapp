'use client';

import PageContainer from '@/components/layout/page-container';
import { useAuth } from '@/providers/auth-provider';
import { teamInfoContent } from '@/config/infoconfig';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  UserPlus,
  Settings,
  Shield,
  Mail,
  MoreHorizontal,
  Trash2,
  Edit
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useState } from 'react';

// =============================================================================
// MOCK DATA (Replace with API calls)
// =============================================================================

const mockMembers = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'owner',
    avatar: null,
    joinedAt: '2024-01-15'
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    role: 'admin',
    avatar: null,
    joinedAt: '2024-02-20'
  },
  {
    id: '3',
    name: 'Bob Wilson',
    email: 'bob@example.com',
    role: 'user',
    avatar: null,
    joinedAt: '2024-03-10'
  }
];

const mockPendingInvites = [
  {
    id: '1',
    email: 'alice@example.com',
    role: 'user',
    invitedAt: '2024-03-25'
  }
];

// =============================================================================
// COMPONENT
// =============================================================================

export default function TeamPage() {
  const { currentCompany, isLoading, isAdmin, user } = useAuth();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [isInviting, setIsInviting] = useState(false);

  const canManageTeam = isAdmin();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner':
        return 'default';
      case 'admin':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;

    setIsInviting(true);
    try {
      // TODO: Implement your API call
      // await inviteToCompany(currentCompany.companyId, { email: inviteEmail, role: inviteRole });

      alert('Invite API - Implement your backend integration');
      setIsInviteOpen(false);
      setInviteEmail('');
      setInviteRole('user');
    } catch (error) {
      console.error('Failed to invite:', error);
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = (memberId: string) => {
    // TODO: Implement your API call
    console.log('Remove member:', memberId);
    alert('Remove member API - Implement your backend integration');
  };

  const handleCancelInvite = (inviteId: string) => {
    // TODO: Implement your API call
    console.log('Cancel invite:', inviteId);
    alert('Cancel invite API - Implement your backend integration');
  };

  return (
    <PageContainer
      pageTitle='Team Management'
      pageDescription='Manage your workspace team, members, roles, security and more.'
      infoContent={teamInfoContent}
      isloading={isLoading}
      access={!!currentCompany}
      accessFallback={
        <div className='flex min-h-[400px] items-center justify-center'>
          <div className='space-y-2 text-center'>
            <h2 className='text-2xl font-semibold'>No Workspace Selected</h2>
            <p className='text-muted-foreground'>
              Please select a workspace to manage team members.
            </p>
          </div>
        </div>
      }
    >
      <Tabs defaultValue='members' className='space-y-6'>
        <TabsList>
          <TabsTrigger value='members'>Members</TabsTrigger>
          <TabsTrigger value='invitations'>Pending Invitations</TabsTrigger>
          <TabsTrigger value='settings'>Settings</TabsTrigger>
        </TabsList>

        {/* Members Tab */}
        <TabsContent value='members' className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div>
              <h3 className='text-lg font-medium'>Team Members</h3>
              <p className='text-sm text-muted-foreground'>
                Manage who has access to this workspace
              </p>
            </div>
            {canManageTeam && (
              <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className='mr-2 h-4 w-4' />
                    Invite Member
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Invite Team Member</DialogTitle>
                    <DialogDescription>
                      Send an invitation to join your workspace.
                    </DialogDescription>
                  </DialogHeader>
                  <div className='space-y-4 py-4'>
                    <div className='space-y-2'>
                      <Label htmlFor='email'>Email Address</Label>
                      <Input
                        id='email'
                        type='email'
                        placeholder='colleague@example.com'
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                      />
                    </div>
                    <div className='space-y-2'>
                      <Label htmlFor='role'>Role</Label>
                      <Select value={inviteRole} onValueChange={setInviteRole}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='user'>Member</SelectItem>
                          <SelectItem value='admin'>Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant='outline'
                      onClick={() => setIsInviteOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleInvite}
                      disabled={!inviteEmail.trim() || isInviting}
                    >
                      {isInviting ? 'Sending...' : 'Send Invitation'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  {canManageTeam && <TableHead className='w-[50px]' />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className='flex items-center gap-3'>
                        <Avatar className='h-8 w-8'>
                          <AvatarImage src={member.avatar || undefined} />
                          <AvatarFallback>
                            {getInitials(member.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className='font-medium'>{member.name}</p>
                          <p className='text-sm text-muted-foreground'>
                            {member.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={getRoleBadgeVariant(member.role)}
                        className='capitalize'
                      >
                        {member.role}
                      </Badge>
                    </TableCell>
                    <TableCell className='text-muted-foreground'>
                      {new Date(member.joinedAt).toLocaleDateString()}
                    </TableCell>
                    {canManageTeam && (
                      <TableCell>
                        {member.role !== 'owner' && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant='ghost' size='icon'>
                                <MoreHorizontal className='h-4 w-4' />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align='end'>
                              <DropdownMenuItem>
                                <Edit className='mr-2 h-4 w-4' />
                                Change Role
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className='text-destructive'
                                onClick={() => handleRemoveMember(member.id)}
                              >
                                <Trash2 className='mr-2 h-4 w-4' />
                                Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Pending Invitations Tab */}
        <TabsContent value='invitations' className='space-y-4'>
          <div>
            <h3 className='text-lg font-medium'>Pending Invitations</h3>
            <p className='text-sm text-muted-foreground'>
              Invitations that haven't been accepted yet
            </p>
          </div>

          {mockPendingInvites.length === 0 ? (
            <Card>
              <CardContent className='flex min-h-[200px] flex-col items-center justify-center'>
                <Mail className='h-10 w-10 text-muted-foreground' />
                <p className='mt-2 text-muted-foreground'>
                  No pending invitations
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Invited</TableHead>
                    {canManageTeam && <TableHead className='w-[50px]' />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockPendingInvites.map((invite) => (
                    <TableRow key={invite.id}>
                      <TableCell className='font-medium'>
                        {invite.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant='outline' className='capitalize'>
                          {invite.role}
                        </Badge>
                      </TableCell>
                      <TableCell className='text-muted-foreground'>
                        {new Date(invite.invitedAt).toLocaleDateString()}
                      </TableCell>
                      {canManageTeam && (
                        <TableCell>
                          <Button
                            variant='ghost'
                            size='sm'
                            className='text-destructive'
                            onClick={() => handleCancelInvite(invite.id)}
                          >
                            Cancel
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value='settings' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Settings className='h-5 w-5' />
                Workspace Settings
              </CardTitle>
              <CardDescription>
                Configure your workspace preferences
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='space-y-2'>
                <Label>Workspace Name</Label>
                <Input
                  defaultValue={currentCompany?.company?.name || ''}
                  disabled={!canManageTeam}
                />
              </div>
              <div className='space-y-2'>
                <Label>Workspace Code</Label>
                <Input
                  defaultValue={currentCompany?.company?.code || ''}
                  disabled
                />
                <p className='text-xs text-muted-foreground'>
                  This is your unique workspace identifier
                </p>
              </div>
              {canManageTeam && (
                <Button>Save Changes</Button>
              )}
            </CardContent>
          </Card>

          <Card className='border-destructive'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2 text-destructive'>
                <Shield className='h-5 w-5' />
                Danger Zone
              </CardTitle>
              <CardDescription>
                Irreversible and destructive actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant='destructive' disabled={!canManageTeam}>
                Delete Workspace
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}