import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cva } from 'class-variance-authority';
import { IconGripVertical } from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import type { KanbanTask } from '@/hooks/use-kanban-socket';

interface TaskCardProps {
  task: KanbanTask;
  isOverlay?: boolean;
}

export type TaskType = 'Task';

export interface TaskDragData {
  type: TaskType;
  task: KanbanTask;
}

export function TaskCard({ task, isOverlay }: TaskCardProps) {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: task.id,
    data: {
      type: 'Task',
      task
    } satisfies TaskDragData,
    attributes: {
      roleDescription: 'Task'
    }
  });

  const style = {
    transition,
    transform: CSS.Translate.toString(transform)
  };

  const variants = cva('mb-2', {
    variants: {
      dragging: {
        over: 'ring-2 opacity-30',
        overlay: 'ring-2 ring-primary'
      }
    }
  });

  const assigneeCount = task.assignees?.length ?? 0;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={variants({
        dragging: isOverlay ? 'overlay' : isDragging ? 'over' : undefined
      })}
    >
      <CardHeader className='space-between border-secondary relative flex flex-row items-center border-b-2 px-3 py-3'>
        <Button
          variant={'ghost'}
          {...attributes}
          {...listeners}
          className='text-secondary-foreground/50 -ml-2 h-auto cursor-grab p-1'
        >
          <span className='sr-only'>Move task</span>
          <IconGripVertical />
        </Button>
        <Badge variant={'outline'} className='ml-auto font-mono text-xs'>
          #{task.taskNo}
        </Badge>
      </CardHeader>
      <CardContent className='flex flex-col gap-2 px-3 pt-3 pb-4 text-left'>
        <p className='text-sm font-medium break-words whitespace-pre-wrap'>
          {task.title}
        </p>
        {task.description && (
          <p className='text-muted-foreground line-clamp-2 text-xs'>
            {task.description}
          </p>
        )}
        <div className='flex items-center gap-2 pt-1'>
          {task.priority && (
            <Badge variant='secondary' className='text-xs capitalize'>
              {task.priority}
            </Badge>
          )}
          {task.status && (
            <Badge variant='outline' className='text-xs capitalize'>
              {task.status}
            </Badge>
          )}
          {assigneeCount > 0 && (
            <span className='text-muted-foreground ml-auto text-xs'>
              {assigneeCount} assignee{assigneeCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
