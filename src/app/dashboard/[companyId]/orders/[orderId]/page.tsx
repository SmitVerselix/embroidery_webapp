import PageContainer from '@/components/layout/page-container';
import OrderDetail from '@/features/orders/components/order-detail';
import OrderViewPage from '@/features/orders/components/order-view-page';

export const metadata = {
  title: 'Dashboard: Design'
};

type PageProps = {
  params: Promise<{ companyId: string; orderId: string }>;
};

export default async function Page(props: PageProps) {
  const params = await props.params;
  const { companyId, orderId } = params;

  // If orderId is 'new', show create form
  if (orderId === 'new') {
    return (
      <PageContainer
        scrollable
        pageTitle='New Design'
        pageDescription='Create a new design for your company and manage its details'
      >
        <div className='flex-1 space-y-4'>
          <OrderViewPage orderId='new' />
        </div>
      </PageContainer>
    );
  }

  // Otherwise show order detail
  return (
    <PageContainer
      scrollable
      pageTitle='Design Details'
      pageDescription='View design details and template values'
    >
      <div className='flex-1 space-y-4'>
        <OrderDetail companyId={companyId} orderId={orderId} />
      </div>
    </PageContainer>
  );
}
