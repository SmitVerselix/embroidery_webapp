'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import { useAuth } from '@/providers/auth-provider';
import { registerCompany } from '@/lib/api/services';
import { getError } from '@/lib/api/axios';
import type { UserCompany } from '@/lib/api/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Building2, Check, Users, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function WorkspacesPage() {
  const { currentCompany, companies, setCurrentCompany, setCompanies, isLoading } = useAuth();
  const router = useRouter();

  // Create dialog state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyCode, setNewCompanyCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Get initials from company name
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Generate code from name
  const generateCode = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 10);
  };

  // Handle company selection
  const handleSelectCompany = (company: UserCompany) => {
    setCurrentCompany(company);
  };

  // Handle create company
  const handleCreateCompany = async () => {
    if (!newCompanyName.trim() || !newCompanyCode.trim()) return;

    setIsCreating(true);
    setCreateError(null);

    try {
      // Call the register company API
      const newCompany = await registerCompany({
        name: newCompanyName.trim(),
        code: newCompanyCode.trim(),
      });

      // Create UserCompany object for the new company
      const userCompany: UserCompany = {
        company: {
          id: newCompany.id,
          name: newCompany.name,
          code: newCompany.code,
        },
        role: {
          id: 'owner',
          name: 'owner',
        },
      };

      // Update companies in auth context
      setCompanies([userCompany, ...companies]);

      // Close dialog and reset form
      setIsCreateOpen(false);
      setNewCompanyName('');
      setNewCompanyCode('');

      // Automatically select the new company
      setCurrentCompany(userCompany);
    } catch (err) {
      setCreateError(getError(err));
    } finally {
      setIsCreating(false);
    }
  };

  // Handle dialog close
  const handleDialogChange = (open: boolean) => {
    setIsCreateOpen(open);
    if (!open) {
      setCreateError(null);
      setNewCompanyName('');
      setNewCompanyCode('');
    }
  };

  return (
    <PageContainer
      pageTitle='Workspaces'
      pageDescription='Manage your workspaces and switch between them'
      isloading={isLoading}
    >
      <div className='space-y-6'>
        {/* Create New Workspace */}
        <div className='flex justify-end'>
          <Dialog open={isCreateOpen} onOpenChange={handleDialogChange}>
            <DialogTrigger asChild>
              <Button>
                <Plus className='mr-2 h-4 w-4' />
                Create Workspace
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Workspace</DialogTitle>
                <DialogDescription>
                  Create a new workspace to collaborate with your team.
                </DialogDescription>
              </DialogHeader>
              <div className='space-y-4 py-4'>
                {/* Error Message */}
                {createError && (
                  <div className='rounded-md bg-destructive/15 p-3 text-sm text-destructive'>
                    {createError}
                  </div>
                )}

                {/* Workspace Name */}
                <div className='space-y-2'>
                  <Label htmlFor='name'>Workspace Name</Label>
                  <Input
                    id='name'
                    placeholder='My Company'
                    value={newCompanyName}
                    onChange={(e) => {
                      setNewCompanyName(e.target.value);
                      setNewCompanyCode(generateCode(e.target.value));
                    }}
                    disabled={isCreating}
                  />
                </div>

                {/* Workspace Code */}
                <div className='space-y-2'>
                  <Label htmlFor='code'>Workspace Code</Label>
                  <Input
                    id='code'
                    placeholder='mycompany'
                    value={newCompanyCode}
                    onChange={(e) =>
                      setNewCompanyCode(
                        e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '')
                      )
                    }
                    disabled={isCreating}
                  />
                  <p className='text-xs text-muted-foreground'>
                    Unique identifier (lowercase, no spaces)
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant='outline'
                  onClick={() => setIsCreateOpen(false)}
                  disabled={isCreating}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateCompany}
                  disabled={!newCompanyName.trim() || !newCompanyCode.trim() || isCreating}
                >
                  {isCreating ? (
                    <>
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                      Creating...
                    </>
                  ) : (
                    'Create Workspace'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Workspaces List */}
        {companies.length === 0 ? (
          <Card>
            <CardContent className='flex min-h-[300px] flex-col items-center justify-center space-y-4'>
              <Building2 className='h-12 w-12 text-muted-foreground' />
              <div className='text-center'>
                <h3 className='text-lg font-semibold'>No Workspaces Yet</h3>
                <p className='text-sm text-muted-foreground'>
                  Create your first workspace to get started
                </p>
              </div>
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className='mr-2 h-4 w-4' />
                Create Workspace
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
            {companies.map((company) => {
              const isSelected = currentCompany?.company?.id === company.company.id;

              return (
                <Card
                  key={company.company.id}
                  className={cn(
                    'cursor-pointer transition-all hover:shadow-md',
                    isSelected && 'border-primary ring-1 ring-primary'
                  )}
                  onClick={() => handleSelectCompany(company)}
                >
                  <CardHeader className='flex flex-row items-center gap-4 space-y-0'>
                    <Avatar className='h-12 w-12'>
                      <AvatarFallback className='text-sm font-medium'>
                        {getInitials(company.company.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className='flex-1'>
                      <CardTitle className='flex items-center gap-2 text-base'>
                        {company.company.name}
                        {isSelected && (
                          <Check className='h-4 w-4 text-primary' />
                        )}
                      </CardTitle>
                      <CardDescription className='capitalize'>
                        {company.role.name}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                        <Users className='h-4 w-4' />
                        <span>@{company.company.code}</span>
                      </div>
                      <Badge variant={isSelected ? 'default' : 'secondary'}>
                        {isSelected ? 'Active' : 'Select'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </PageContainer>
  );
}