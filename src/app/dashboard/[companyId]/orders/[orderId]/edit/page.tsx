import PageContainer from '@/components/layout/page-container';
import OrderViewPage from '@/features/orders/components/order-view-page';

export const metadata = {
  title: 'Dashboard: Edit Order'
};

type PageProps = {
  params: Promise<{ companyId: string; orderId: string }>;
};

export default async function Page(props: PageProps) {
  const params = await props.params;
  const { orderId } = params;

  return (
    <PageContainer scrollable>
      <div className='flex-1 space-y-4'>
        <OrderViewPage orderId={orderId} />
      </div>
    </PageContainer>
  );
}
