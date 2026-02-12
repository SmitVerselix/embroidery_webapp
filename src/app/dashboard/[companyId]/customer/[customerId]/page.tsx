import PageContainer from '@/components/layout/page-container';
import CustomerDetailPage from '@/features/customers/components/customer-detail-page';
import CustomerViewPage from '@/features/customers/components/customer-view-page';

export const metadata = {
  title: 'Dashboard: Customer'
};

type PageProps = {
  params: Promise<{ companyId: string; customerId: string }>;
  searchParams: Promise<{ edit?: string }>;
};

export default async function Page(props: PageProps) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const { companyId, customerId } = params;
  const isEdit = 'edit' in searchParams;

  // If customerId is 'new', show create form
  if (customerId === 'new') {
    return (
      <PageContainer scrollable>
        <div className='flex-1 space-y-4'>
          <CustomerViewPage customerId='new' />
        </div>
      </PageContainer>
    );
  }

  // If edit mode, show edit form
  if (isEdit) {
    return (
      <PageContainer scrollable>
        <div className='flex-1 space-y-4'>
          <CustomerViewPage customerId={customerId} />
        </div>
      </PageContainer>
    );
  }

  // Otherwise show customer detail
  return (
    <PageContainer scrollable>
      <div className='flex-1 space-y-4'>
        <CustomerDetailPage companyId={companyId} customerId={customerId} />
      </div>
    </PageContainer>
  );
}
