'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { getMyCompanies, registerCompany } from '@/lib/api/services';
import { getError } from '@/lib/api/axios';
import type { UserCompany } from '@/lib/api/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Building2,
  Plus,
  Search,
  Loader2,
  ArrowRight,
  LogOut,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/use-debounce';

// =============================================================================
// CONSTANTS
// =============================================================================

const ITEMS_PER_PAGE = 10;

// =============================================================================
// COMPONENT
// =============================================================================

export default function SelectCompanyPage() {
  const {
    user,
    setCurrentCompany,
    setCompanies,
    logout,
    isLoading: authLoading
  } = useAuth();

  // State
  const [companies, setLocalCompanies] = useState<UserCompany[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Create company dialog
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyCode, setNewCompanyCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Refs
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Debounced search
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Fetch companies
  const fetchCompanies = useCallback(
    async (pageNum: number, search: string, append: boolean = false) => {
      if (pageNum === 1) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      setError(null);

      try {
        const response = await getMyCompanies({
          page: pageNum,
          limit: ITEMS_PER_PAGE,
          search: search || '',
          sortBy: 'createdAt',
          sortOrder: 'DESC'
        });

        const newCompanies = response.rows;
        const total = response.count;

        if (append) {
          setLocalCompanies((prev) => [...prev, ...newCompanies]);
        } else {
          setLocalCompanies(newCompanies);
          // Store all companies in auth context for first load
          setCompanies(newCompanies);
        }

        setTotalCount(total);
        setHasMore(pageNum * ITEMS_PER_PAGE < total);
      } catch (err) {
        setError(getError(err));
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [setCompanies]
  );

  // Initial load and search
  useEffect(() => {
    setPage(1);
    setLocalCompanies([]);
    fetchCompanies(1, debouncedSearch, false);
  }, [debouncedSearch, fetchCompanies]);

  // Infinite scroll observer
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          hasMore &&
          !isLoadingMore &&
          !isLoading
        ) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchCompanies(nextPage, debouncedSearch, true);
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [
    hasMore,
    isLoadingMore,
    isLoading,
    page,
    debouncedSearch,
    fetchCompanies
  ]);

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
        code: newCompanyCode.trim()
      });

      // Create UserCompany object for the new company
      const userCompany: UserCompany = {
        company: {
          id: newCompany.id,
          name: newCompany.name,
          code: newCompany.code
        },
        role: {
          id: 'owner',
          name: 'owner'
        }
      };

      // Add to local list
      setLocalCompanies((prev) => [userCompany, ...prev]);
      setTotalCount((prev) => prev + 1);

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

  // Refresh list
  const handleRefresh = () => {
    setPage(1);
    fetchCompanies(1, debouncedSearch, false);
  };

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

  if (authLoading) {
    return (
      <div className='flex h-screen items-center justify-center'>
        <Loader2 className='text-muted-foreground h-8 w-8 animate-spin' />
      </div>
    );
  }

  return (
    <div className='bg-background flex min-h-screen flex-col'>
      {/* Header */}
      <header className='bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 border-b backdrop-blur'>
        <div className='container mx-auto flex h-16 items-center justify-between px-4'>
          <div className='flex items-center gap-2'>
            <Building2 className='h-6 w-6' />
            <span className='font-semibold'>Select Workspace</span>
          </div>
          <div className='flex items-center gap-4'>
            <span className='text-muted-foreground hidden text-sm sm:inline-block'>
              {user?.email}
            </span>
            <Button variant='ghost' size='sm' onClick={logout}>
              <LogOut className='h-4 w-4 sm:mr-2' />
              <span className='hidden sm:inline-block'>Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className='flex-1'>
        <div className='container mx-auto px-4 py-8'>
          <div className='mx-auto max-w-3xl'>
            {/* Title */}
            <div className='mb-8 text-center'>
              <h1 className='text-3xl font-bold tracking-tight'>
                Welcome, {user?.name?.split(' ')[0] || 'User'}!
              </h1>
              <p className='text-muted-foreground mt-2'>
                Select a workspace to continue or create a new one
              </p>
            </div>

            {/* Search and Create */}
            <div className='mb-6 flex flex-col gap-4 sm:flex-row'>
              <div className='relative flex-1'>
                <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
                <Input
                  placeholder='Search workspaces...'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className='pl-10'
                />
              </div>
              <div className='flex gap-2'>
                <Button
                  variant='outline'
                  size='icon'
                  onClick={handleRefresh}
                  disabled={isLoading}
                >
                  <RefreshCw
                    className={cn('h-4 w-4', isLoading && 'animate-spin')}
                  />
                </Button>
                <Dialog
                  open={isCreateOpen}
                  onOpenChange={(open) => {
                    setIsCreateOpen(open);
                    if (!open) {
                      setCreateError(null);
                      setNewCompanyName('');
                      setNewCompanyCode('');
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className='mr-2 h-4 w-4' />
                      <span className='hidden sm:inline-block'>
                        Create Workspace
                      </span>
                      <span className='sm:hidden'>Create</span>
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
                        <div className='bg-destructive/15 text-destructive rounded-md p-3 text-sm'>
                          {createError}
                        </div>
                      )}
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
                      <div className='space-y-2'>
                        <Label htmlFor='code'>Workspace Code</Label>
                        <Input
                          id='code'
                          placeholder='mycompany'
                          value={newCompanyCode}
                          onChange={(e) =>
                            setNewCompanyCode(
                              e.target.value
                                .toLowerCase()
                                .replace(/[^a-z0-9]/g, '')
                            )
                          }
                          disabled={isCreating}
                        />
                        <p className='text-muted-foreground text-xs'>
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
                        disabled={
                          !newCompanyName.trim() ||
                          !newCompanyCode.trim() ||
                          isCreating
                        }
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
            </div>

            {/* Results count */}
            {!isLoading && (
              <p className='text-muted-foreground mb-4 text-sm'>
                {totalCount} workspace{totalCount !== 1 ? 's' : ''} found
                {searchQuery && ` for "${searchQuery}"`}
              </p>
            )}

            {/* Error */}
            {error && (
              <div className='bg-destructive/15 text-destructive mb-6 rounded-lg p-4'>
                <p>{error}</p>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={handleRefresh}
                  className='mt-2'
                >
                  Try Again
                </Button>
              </div>
            )}

            {/* Companies List */}
            <div className='space-y-3'>
              {isLoading ? (
                // Loading skeletons
                Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className='p-4'>
                      <div className='flex items-center gap-4'>
                        <Skeleton className='h-12 w-12 rounded-lg' />
                        <div className='flex-1 space-y-2'>
                          <Skeleton className='h-4 w-32' />
                          <Skeleton className='h-3 w-24' />
                        </div>
                        <Skeleton className='h-9 w-24' />
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : companies.length === 0 ? (
                // Empty state
                <Card>
                  <CardContent className='flex min-h-[200px] flex-col items-center justify-center p-8'>
                    <Building2 className='text-muted-foreground h-12 w-12' />
                    <h3 className='mt-4 text-lg font-semibold'>
                      {searchQuery
                        ? 'No workspaces found'
                        : 'No Workspaces Yet'}
                    </h3>
                    <p className='text-muted-foreground mt-1 text-center text-sm'>
                      {searchQuery
                        ? 'Try a different search term'
                        : 'Create your first workspace to get started'}
                    </p>
                    {!searchQuery && (
                      <Button
                        className='mt-4'
                        onClick={() => setIsCreateOpen(true)}
                      >
                        <Plus className='mr-2 h-4 w-4' />
                        Create Workspace
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                // Companies list
                companies.map((item) => (
                  <Card
                    key={item.company.id}
                    className={cn(
                      'hover:border-primary/50 cursor-pointer transition-all hover:shadow-md'
                    )}
                    onClick={() => handleSelectCompany(item)}
                  >
                    <CardContent className='p-4'>
                      <div className='flex items-center gap-4'>
                        <Avatar className='h-12 w-12 rounded-lg'>
                          <AvatarFallback className='bg-primary/10 text-primary rounded-lg'>
                            {getInitials(item.company.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className='min-w-0 flex-1'>
                          <div className='flex items-center gap-2'>
                            <h3 className='truncate font-semibold'>
                              {item.company.name}
                            </h3>
                            <Badge
                              variant='secondary'
                              className='text-xs capitalize'
                            >
                              {item.role.name}
                            </Badge>
                          </div>
                          <p className='text-muted-foreground text-sm'>
                            @{item.company.code}
                          </p>
                        </div>
                        <Button variant='ghost' size='sm' className='shrink-0'>
                          Select
                          <ArrowRight className='ml-2 h-4 w-4' />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}

              {/* Load more trigger */}
              {hasMore && !isLoading && (
                <div ref={loadMoreRef} className='py-4'>
                  {isLoadingMore && (
                    <div className='flex justify-center'>
                      <Loader2 className='text-muted-foreground h-6 w-6 animate-spin' />
                    </div>
                  )}
                </div>
              )}

              {/* End of list message */}
              {!hasMore && companies.length > 0 && !isLoading && (
                <p className='text-muted-foreground py-4 text-center text-sm'>
                  You've reached the end of the list
                </p>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className='border-t py-4'>
        <div className='text-muted-foreground container mx-auto px-4 text-center text-sm'>
          Need help? Contact support
        </div>
      </footer>
    </div>
  );
}
