import PageContainer from '@/components/layout/page-container';
import OrdersFormDetail from '@/features/orders-form/components/orders-form-detail';
import OrdersFormViewPage from '@/features/orders-form/components/orders-form-view-page';

export const metadata = {
  title: 'Dashboard: Oders Form'
};

type PageProps = {
  params: Promise<{ companyId: string; ordersFormId: string }>;
};

export default async function Page(props: PageProps) {
  const params = await props.params;
  const { companyId, ordersFormId } = params;

  // If orderId is 'new', show create form
  if (ordersFormId === 'new') {
    return (
      <PageContainer
        scrollable
        pageTitle='New Oders Form'
        pageDescription='Create a new design for your company and manage its details'
      >
        <div className='flex-1 space-y-4'>
          <OrdersFormViewPage orderId='new' />
        </div>
      </PageContainer>
    );
  }

  // Otherwise show order detail
  return (
    <PageContainer
      scrollable
      pageTitle='Oders Form Details'
      pageDescription='View design details and template values'
    >
      <div className='flex-1 space-y-4'>
        <OrdersFormDetail companyId={companyId} orderId={ordersFormId} />
      </div>
    </PageContainer>
  );
}
