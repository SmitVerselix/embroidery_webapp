'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { getMembers, createKanbanPermissionUser } from '@/lib/api/services';
import { getError } from '@/lib/api/axios';
import type { KanbanSection, Member } from '@/lib/api/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Loader2, Search, Check, X, User } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';

// =============================================================================
// PROPS
// =============================================================================

interface KanbanPermissionAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: KanbanSection[];
  onSuccess?: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function KanbanPermissionAddDialog({
  open,
  onOpenChange,
  sections,
  onSuccess
}: KanbanPermissionAddDialogProps) {
  const params = useParams();
  const { currentCompany } = useAuth();

  const companyId =
    (params?.companyId as string) || currentCompany?.company?.id;
  const kanbanId = params?.kanbanId as string;

  // ── State ──────────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [sectionId, setSectionId] = useState('');
  const [canViewAllTasks, setCanViewAllTasks] = useState(true);

  // Member autocomplete — scroll-based pagination
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const debouncedSearch = useDebounce(memberSearch, 300);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Prevent re-fetching while a fetch is in progress
  const isFetchingRef = useRef(false);

  const LIMIT = 10;

  // ── Fetch members (page-based) ─────────────────────────────────────────
  const fetchMembers = useCallback(
    async (pageNum: number, search: string, append: boolean) => {
      if (!companyId || isFetchingRef.current) return;

      isFetchingRef.current = true;

      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoadingMembers(true);
      }

      try {
        const response = await getMembers(companyId, {
          page: pageNum,
          limit: LIMIT,
          search,
          sortBy: 'createdAt',
          sortOrder: 'DESC'
        });

        if (append) {
          setMembers((prev) => [...prev, ...response.rows]);
        } else {
          setMembers(response.rows);
        }

        // Determine if more pages exist
        const totalFetched = append ? pageNum * LIMIT : response.rows.length;
        setHasMore(
          response.rows.length === LIMIT && totalFetched < response.count
        );
      } catch (err) {
        console.error('Failed to fetch members:', getError(err));
      } finally {
        setIsLoadingMembers(false);
        setIsLoadingMore(false);
        isFetchingRef.current = false;
      }
    },
    [companyId]
  );

  // ── Initial load when dialog opens ─────────────────────────────────────
  useEffect(() => {
    if (open && companyId) {
      setPage(1);
      setHasMore(true);
      fetchMembers(1, '', false);
    }
  }, [open, companyId, fetchMembers]);

  // ── Re-fetch when search changes (debounced) ──────────────────────────
  useEffect(() => {
    if (!open) return;

    // Reset to page 1 with new search
    setPage(1);
    setHasMore(true);
    fetchMembers(1, debouncedSearch, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // ── Scroll handler — load next page when near bottom ───────────────────
  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el || !hasMore || isLoadingMore || isFetchingRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = el;
    const threshold = 40; // px from bottom

    if (scrollTop + clientHeight >= scrollHeight - threshold) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchMembers(nextPage, debouncedSearch, true);
    }
  }, [hasMore, isLoadingMore, page, debouncedSearch, fetchMembers]);

  // ── Close dropdown on outside click ────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Reset form when dialog closes ─────────────────────────────────────
  useEffect(() => {
    if (!open) {
      setSelectedMember(null);
      setSectionId('');
      setCanViewAllTasks(true);
      setMemberSearch('');
      setIsDropdownOpen(false);
      setError(null);
      setMembers([]);
      setPage(1);
      setHasMore(true);
    }
  }, [open]);

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleSelectMember = (member: Member) => {
    setSelectedMember(member);
    setMemberSearch(member.user?.name || member.user?.email || '');
    setIsDropdownOpen(false);
  };

  const handleClearMember = () => {
    setSelectedMember(null);
    setMemberSearch('');
    setPage(1);
    setHasMore(true);
    fetchMembers(1, '', false);
    inputRef.current?.focus();
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!companyId || !kanbanId) {
      setError('No company or board selected');
      return;
    }
    if (!selectedMember) {
      setError('Please select a user');
      return;
    }
    if (!sectionId) {
      setError('Please select a section');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await createKanbanPermissionUser(companyId, kanbanId, {
        userId: selectedMember.userId,
        sectionId,
        canViewAllTasks
      });

      onSuccess?.();
    } catch (err) {
      setError(getError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[480px]'>
        <DialogHeader>
          <DialogTitle>Add User Permission</DialogTitle>
          <DialogDescription>
            Assign permissions to a team member for this board.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className='space-y-4'>
          {/* Error */}
          {error && (
            <div className='bg-destructive/15 text-destructive rounded-md p-3 text-sm'>
              {error}
            </div>
          )}

          {/* ── User Autocomplete with Infinite Scroll ──────────────────── */}
          <div className='space-y-2'>
            <Label>
              User <span className='text-destructive'>*</span>
            </Label>
            <div className='relative' ref={dropdownRef}>
              <div className='relative'>
                <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
                <Input
                  ref={inputRef}
                  placeholder='Search by name or email...'
                  value={memberSearch}
                  onChange={(e) => {
                    setMemberSearch(e.target.value);
                    setSelectedMember(null);
                    setIsDropdownOpen(true);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  className='pr-10 pl-10'
                  disabled={isSubmitting}
                  autoComplete='off'
                />
                {selectedMember && (
                  <button
                    type='button'
                    onClick={handleClearMember}
                    className='text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2'
                  >
                    <X className='h-4 w-4' />
                  </button>
                )}
              </div>

              {/* Selected member chip */}
              {selectedMember && (
                <div className='bg-muted/50 mt-2 flex items-center gap-2 rounded-md border p-2'>
                  <div className='min-w-0 flex-1'>
                    <p className='truncate text-sm font-medium'>
                      {selectedMember.user?.name || 'Unknown'}
                    </p>
                    <p className='text-muted-foreground truncate text-xs'>
                      {selectedMember.user?.email}
                    </p>
                  </div>
                  <Check className='h-4 w-4 shrink-0 text-emerald-500' />
                </div>
              )}

              {/* Dropdown list with scroll pagination */}
              {isDropdownOpen && !selectedMember && (
                <div
                  ref={listRef}
                  onScroll={handleScroll}
                  className='bg-popover absolute z-50 mt-1 max-h-[200px] w-full overflow-y-auto rounded-md border shadow-md'
                >
                  {/* Initial loading */}
                  {isLoadingMembers && members.length === 0 ? (
                    <div className='flex items-center justify-center gap-2 py-4'>
                      <Loader2 className='h-4 w-4 animate-spin' />
                      <span className='text-muted-foreground text-sm'>
                        Loading members...
                      </span>
                    </div>
                  ) : members.length === 0 ? (
                    <div className='flex items-center justify-center gap-2 py-4'>
                      <User className='text-muted-foreground h-4 w-4' />
                      <span className='text-muted-foreground text-sm'>
                        No members found
                      </span>
                    </div>
                  ) : (
                    <>
                      {members.map((member) => (
                        <button
                          key={member.id}
                          type='button'
                          className='hover:bg-accent flex w-full items-center gap-3 px-3 py-2 text-left transition-colors'
                          onClick={() => handleSelectMember(member)}
                        >
                          <div className='min-w-0 flex-1'>
                            <p className='truncate text-sm font-medium'>
                              {member.user?.name || 'Unknown'}
                            </p>
                            <p className='text-muted-foreground truncate text-xs'>
                              {member.user?.email}
                            </p>
                          </div>
                        </button>
                      ))}

                      {/* Loading more indicator at bottom */}
                      {isLoadingMore && (
                        <div className='flex items-center justify-center gap-2 py-3'>
                          <Loader2 className='h-3 w-3 animate-spin' />
                          <span className='text-muted-foreground text-xs'>
                            Loading more...
                          </span>
                        </div>
                      )}

                      {/* End of list */}
                      {!hasMore && members.length > 0 && (
                        <div className='text-muted-foreground py-2 text-center text-xs'>
                          No more members
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Section ─────────────────────────────────────────────────── */}
          <div className='space-y-2'>
            <Label>
              Section <span className='text-destructive'>*</span>
            </Label>
            <Select
              value={sectionId}
              onValueChange={setSectionId}
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder='Select a section' />
              </SelectTrigger>
              <SelectContent>
                {sections.map((section) => (
                  <SelectItem key={section.id} value={section.id}>
                    {section.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ── View All Tasks toggle ────────────────────────────────────── */}
          <div className='flex items-center justify-between rounded-lg border p-3'>
            <div className='space-y-0.5'>
              <Label htmlFor='add-view-all'>View All Tasks</Label>
              <p className='text-muted-foreground text-sm'>
                Allow this user to view all tasks in the section
              </p>
            </div>
            <Switch
              id='add-view-all'
              checked={canViewAllTasks}
              onCheckedChange={setCanViewAllTasks}
              disabled={isSubmitting}
            />
          </div>

          {/* Footer */}
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type='submit'
              disabled={isSubmitting || !selectedMember || !sectionId}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Adding...
                </>
              ) : (
                'Add Permission'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
