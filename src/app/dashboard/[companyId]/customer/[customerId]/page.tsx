import PageContainer from '@/components/layout/page-container';
import CustomerDetailPage from '@/features/customers/components/customer-detail-page';
import CustomerViewPage from '@/features/customers/components/customer-view-page';

export const metadata = {
  title: 'Dashboard: Customer'
};

type PageProps = {
  params: Promise<{ companyId: string; customerId: string }>;
};

export default async function Page(props: PageProps) {
  const params = await props.params;
  const { companyId, customerId } = params;

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

  // Otherwise show customer detail
  return (
    <PageContainer scrollable>
      <div className='flex-1 space-y-4'>
        <CustomerDetailPage companyId={companyId} customerId={customerId} />
      </div>
    </PageContainer>
  );
}
