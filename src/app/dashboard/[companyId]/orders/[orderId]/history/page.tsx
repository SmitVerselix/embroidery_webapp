import PageContainer from '@/components/layout/page-container';
import { buttonVariants } from '@/components/ui/button';
import OrderHistory from '@/features/orders/components/order-history';
import { cn } from '@/lib/utils';
import { IconArrowLeft } from '@tabler/icons-react';
import Link from 'next/link';

export const metadata = {
  title: 'Dashboard: Order History'
};

type PageProps = {
  params: Promise<{ companyId: string; orderId: string }>;
};

export default async function Page(props: PageProps) {
  const params = await props.params;
  const { companyId, orderId } = params;

  return (
    <PageContainer
      scrollable={false}
      pageTitle='Order History'
      pageDescription='View all changes and actions performed on this order'
      pageHeaderAction={
        <Link
          href={`/dashboard/${companyId}/orders/${orderId}`}
          className={cn(
            buttonVariants({ variant: 'outline' }),
            'text-xs md:text-sm'
          )}
        >
          <IconArrowLeft className='mr-2 h-4 w-4' /> Back to Order
        </Link>
      }
    >
      <OrderHistory companyId={companyId} orderId={orderId} />
    </PageContainer>
  );
}
