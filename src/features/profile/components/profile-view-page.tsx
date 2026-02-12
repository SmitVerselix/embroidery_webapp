'use client';

import { useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import {
  User,
  Mail,
  Phone,
  Camera,
  Trash2,
  Shield,
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

export default function ProfileViewPage() {
  const { user, isLoading } = useAuth();

  // Profile form state
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.mobile || '');
  const [bio, setBio] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Avatar state
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || 'U';

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      // TODO: Implement your API call
      // await updateProfile({ name, phone, bio });

      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate API call
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsChangingPassword(true);
    try {
      // TODO: Implement your API call
      // await changePassword({ currentPassword, newPassword });

      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate API call
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.error('Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      // TODO: Implement your API call
      // const formData = new FormData();
      // formData.append('avatar', file);
      // await uploadAvatar(formData);

      await new Promise((resolve) => setTimeout(resolve, 1500)); // Simulate API call
      toast.success('Avatar uploaded successfully');
    } catch (error) {
      toast.error('Failed to upload avatar');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleDeleteAvatar = async () => {
    try {
      // TODO: Implement your API call
      // await deleteAvatar();

      toast.success('Avatar removed');
    } catch (error) {
      toast.error('Failed to remove avatar');
    }
  };

  if (isLoading) {
    return (
      <div className='flex h-[400px] items-center justify-center'>
        <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    );
  }

  return (
    <div className='flex w-full flex-col p-4'>
      <div className='mx-auto w-full max-w-4xl space-y-6'>
        {/* Header */}
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Profile</h1>
          <p className='text-muted-foreground'>
            Manage your account settings and preferences
          </p>
        </div>

        <Tabs defaultValue='general' className='space-y-6'>
          <TabsList>
            <TabsTrigger value='general'>General</TabsTrigger>
            <TabsTrigger value='security'>Security</TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value='general' className='space-y-6'>
            {/* Avatar Card */}
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Camera className='h-5 w-5' />
                  Profile Picture
                </CardTitle>
                <CardDescription>
                  Upload a photo to personalize your profile
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className='flex items-center gap-6'>
                  <div className='relative'>
                    <Avatar className='h-24 w-24'>
                      <AvatarImage src={user?.profileImage || undefined} />
                      <AvatarFallback className='text-2xl'>
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    {isUploadingAvatar && (
                      <div className='absolute inset-0 flex items-center justify-center rounded-full bg-black/50'>
                        <Loader2 className='h-6 w-6 animate-spin text-white' />
                      </div>
                    )}
                  </div>
                  <div className='space-y-2'>
                    <div className='flex gap-2'>
                      <Button variant='outline' size='sm' asChild>
                        <label className='cursor-pointer'>
                          <Camera className='mr-2 h-4 w-4' />
                          Upload
                          <input
                            type='file'
                            accept='image/*'
                            className='hidden'
                            onChange={handleAvatarUpload}
                            disabled={isUploadingAvatar}
                          />
                        </label>
                      </Button>
                      {user?.profileImage && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant='outline' size='sm'>
                              <Trash2 className='mr-2 h-4 w-4' />
                              Remove
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove Avatar</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to remove your profile
                                picture?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={handleDeleteAvatar}>
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                    <p className='text-xs text-muted-foreground'>
                      JPG, PNG or GIF. Max 5MB.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Personal Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <User className='h-5 w-5' />
                  Personal Information
                </CardTitle>
                <CardDescription>
                  Update your personal details
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='grid gap-4 sm:grid-cols-2'>
                  <div className='space-y-2'>
                    <Label htmlFor='name'>Full Name</Label>
                    <Input
                      id='name'
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder='John Doe'
                    />
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='phone'>Phone Number</Label>
                    <Input
                      id='phone'
                      type='tel'
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder='+1 (555) 123-4567'
                    />
                  </div>
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='bio'>Bio</Label>
                  <Textarea
                    id='bio'
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder='Tell us about yourself...'
                    rows={3}
                  />
                  <p className='text-xs text-muted-foreground'>
                    {bio.length}/500 characters
                  </p>
                </div>
                <Button onClick={handleSaveProfile} disabled={isSaving}>
                  {isSaving && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                  Save Changes
                </Button>
              </CardContent>
            </Card>

            {/* Account Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Mail className='h-5 w-5' />
                  Account Information
                </CardTitle>
                <CardDescription>
                  Your account details and verification status
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='space-y-2'>
                  <Label>Email Address</Label>
                  <div className='flex items-center gap-2'>
                    <Input value={user?.email || ''} disabled />
                    {user?.isEmailVerified ? (
                      <Badge
                        variant='outline'
                        className='gap-1 text-green-600'
                      >
                        <CheckCircle2 className='h-3 w-3' />
                        Verified
                      </Badge>
                    ) : (
                      <Badge
                        variant='outline'
                        className='gap-1 text-yellow-600'
                      >
                        <AlertCircle className='h-3 w-3' />
                        Unverified
                      </Badge>
                    )}
                  </div>
                </div>
                <Separator />
                <div className='space-y-1'>
                  <p className='text-sm font-medium'>Member Since</p>
                  <p className='text-sm text-muted-foreground'>
                    {user?.createdAt
                      ? new Date(user.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })
                      : 'N/A'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value='security' className='space-y-6'>
            {/* Change Password Card */}
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Key className='h-5 w-5' />
                  Change Password
                </CardTitle>
                <CardDescription>
                  Update your password to keep your account secure
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='space-y-2'>
                  <Label htmlFor='currentPassword'>Current Password</Label>
                  <div className='relative'>
                    <Input
                      id='currentPassword'
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder='Enter current password'
                    />
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon'
                      className='absolute right-0 top-0 h-full px-3'
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      {showCurrentPassword ? (
                        <EyeOff className='h-4 w-4' />
                      ) : (
                        <Eye className='h-4 w-4' />
                      )}
                    </Button>
                  </div>
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='newPassword'>New Password</Label>
                  <div className='relative'>
                    <Input
                      id='newPassword'
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder='Enter new password'
                    />
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon'
                      className='absolute right-0 top-0 h-full px-3'
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? (
                        <EyeOff className='h-4 w-4' />
                      ) : (
                        <Eye className='h-4 w-4' />
                      )}
                    </Button>
                  </div>
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='confirmPassword'>Confirm New Password</Label>
                  <Input
                    id='confirmPassword'
                    type='password'
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder='Confirm new password'
                  />
                </div>
                <Button
                  onClick={handleChangePassword}
                  disabled={
                    isChangingPassword ||
                    !currentPassword ||
                    !newPassword ||
                    !confirmPassword
                  }
                >
                  {isChangingPassword && (
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  )}
                  Change Password
                </Button>
              </CardContent>
            </Card>

            {/* Security Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Shield className='h-5 w-5' />
                  Security Settings
                </CardTitle>
                <CardDescription>
                  Manage your account security preferences
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='flex items-center justify-between'>
                  <div>
                    <p className='font-medium'>Two-Factor Authentication</p>
                    <p className='text-sm text-muted-foreground'>
                      Add an extra layer of security to your account
                    </p>
                  </div>
                  <Button variant='outline'>Enable 2FA</Button>
                </div>
                <Separator />
                <div className='flex items-center justify-between'>
                  <div>
                    <p className='font-medium'>Active Sessions</p>
                    <p className='text-sm text-muted-foreground'>
                      Manage devices where you're logged in
                    </p>
                  </div>
                  <Button variant='outline'>View Sessions</Button>
                </div>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className='border-destructive'>
              <CardHeader>
                <CardTitle className='text-destructive'>Danger Zone</CardTitle>
                <CardDescription>
                  Irreversible and destructive actions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant='destructive'>Delete Account</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Account</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently
                        delete your account and remove all associated data.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction className='bg-destructive text-destructive-foreground hover:bg-destructive/90'>
                        Delete Account
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}