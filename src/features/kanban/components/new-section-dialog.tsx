'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
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
import { Loader2 } from 'lucide-react';

// =============================================================================
// PROPS
// =============================================================================

interface NewSectionDialogProps {
  onCreateSection: (name: string) => void;
  isConnected: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function NewSectionDialog({
  onCreateSection,
  isConnected
}: NewSectionDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const trimmed = title.trim();
    if (!trimmed) return;

    setIsSubmitting(true);
    onCreateSection(trimmed);

    // Reset & close after a brief delay (response arrives via socket listener)
    setTimeout(() => {
      setTitle('');
      setIsSubmitting(false);
      setOpen(false);
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant='secondary' size='lg' className='w-full'>
          ＋ Add New Section
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>Add New Section</DialogTitle>
          <DialogDescription>
            Create a new section for your Kanban board.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className='grid gap-4 py-4'>
          <div className='space-y-2'>
            <Label htmlFor='section-title'>Section Title</Label>
            <Input
              id='section-title'
              placeholder='e.g. To Do, In Progress, Done...'
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
              autoComplete='off'
              autoFocus
            />
          </div>

          {!isConnected && (
            <p className='text-sm text-amber-600'>
              Socket is not connected. Please wait...
            </p>
          )}

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type='submit'
              size='sm'
              disabled={isSubmitting || !title.trim() || !isConnected}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Creating...
                </>
              ) : (
                'Add Section'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
