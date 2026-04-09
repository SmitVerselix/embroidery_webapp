import PageContainer from '@/components/layout/page-container';
import OrdersFormViewPage from '@/features/orders-form/components/orders-form-view-page';

export const metadata = {
  title: 'Dashboard: Edit Orders Form'
};

type PageProps = {
  params: Promise<{ companyId: string; ordersFormId: string }>;
};

export default async function Page(props: PageProps) {
  const params = await props.params;
  const { ordersFormId } = params;

  return (
    <PageContainer scrollable>
      <div className='flex-1 space-y-4'>
        <OrdersFormViewPage orderId={ordersFormId} />
      </div>
    </PageContainer>
  );
}
