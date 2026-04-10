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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Plus } from 'lucide-react';

// =============================================================================
// PROPS
// =============================================================================

interface NewTaskDialogProps {
  onCreateTask: (title: string, description?: string) => void;
  isConnected: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================
//
// NOTE: The task:create event spec has not been confirmed yet. This dialog
// emits via the `createTask` stub on useKanbanSocket with a best-guess
// payload. Once the real backend spec arrives, adjust the payload inside
// the hook — this component won't need to change.
// =============================================================================

export default function NewTaskDialog({
  onCreateTask,
  isConnected
}: NewTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    setIsSubmitting(true);
    onCreateTask(trimmedTitle, description.trim() || undefined);

    // Response arrives via socket listener — reset & close shortly after.
    setTimeout(() => {
      setTitle('');
      setDescription('');
      setIsSubmitting(false);
      setOpen(false);
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant='ghost' size='sm' className='w-full justify-start'>
          <Plus className='mr-2 h-4 w-4' />
          Add Task
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>Add New Task</DialogTitle>
          <DialogDescription>
            Create a new task in this section.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className='grid gap-4 py-4'>
          <div className='space-y-2'>
            <Label htmlFor='task-title'>
              Title <span className='text-destructive'>*</span>
            </Label>
            <Input
              id='task-title'
              placeholder='Task title...'
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
              autoComplete='off'
              autoFocus
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='task-description'>Description</Label>
            <Textarea
              id='task-description'
              placeholder='What needs to be done?'
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              rows={3}
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
                'Add Task'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
