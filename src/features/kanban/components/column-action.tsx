'use client';

import { DotsHorizontalIcon } from '@radix-ui/react-icons';
import * as React from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { UniqueIdentifier } from '@dnd-kit/core';
import { Input } from '@/components/ui/input';

export function ColumnActions({
  title,
  id,
  onRenameSection,
  onDeleteSection
}: {
  title: string;
  id: UniqueIdentifier;
  onRenameSection?: (sectionId: string, newName: string) => void;
  onDeleteSection?: (sectionId: string) => void;
}) {
  const [name, setName] = React.useState(title);
  const [editDisable, setIsEditDisable] = React.useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Keep local name in sync if title changes from server
  React.useEffect(() => {
    setName(title);
  }, [title]);

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setIsEditDisable(true);
          const trimmed = name.trim();
          if (trimmed && trimmed !== title) {
            onRenameSection?.(id as string, trimmed);
          }
        }}
      >
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className='mt-0! mr-auto text-base disabled:cursor-pointer disabled:border-none disabled:opacity-100'
          disabled={editDisable}
          ref={inputRef}
        />
      </form>

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant='secondary' className='ml-1'>
            <span className='sr-only'>Actions</span>
            <DotsHorizontalIcon className='h-4 w-4' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          <DropdownMenuItem
            onSelect={() => {
              setIsEditDisable(false);
              setTimeout(() => {
                inputRef.current?.focus();
              }, 500);
            }}
          >
            Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setShowDeleteDialog(true)}
            className='text-red-600'
          >
            Delete Section
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Are you sure you want to delete this section?
            </AlertDialogTitle>
            <AlertDialogDescription>
              NOTE: All tasks related to this section will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant='destructive'
              onClick={() => {
                setTimeout(() => (document.body.style.pointerEvents = ''), 100);
                setShowDeleteDialog(false);
                onDeleteSection?.(id as string);
              }}
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
