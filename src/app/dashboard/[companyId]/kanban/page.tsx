import KanbanViewPage from '@/features/kanban/components/kanban-view-page';
import KanbanTablePage from '@/features/kanban/components/kanban-table-page';

export const metadata = {
  title: 'Dashboard : Kanban view'
};

export default function KanbanPage() {
  return <KanbanTablePage />;
}
