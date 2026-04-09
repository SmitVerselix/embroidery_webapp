import PageContainer from '@/components/layout/page-container';
import { buttonVariants } from '@/components/ui/button';
import OrdersFormListing from '@/features/orders-form/components/orders-form-listing';
import { cn } from '@/lib/utils';
import { IconPlus } from '@tabler/icons-react';
import Link from 'next/link';

export const metadata = {
  title: 'Dashboard: Orders Form'
};

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function Page(props: PageProps) {
  const params = await props.params;
  const { companyId } = params;

  return (
    <PageContainer
      scrollable={false}
      pageTitle='Orders Form'
      pageDescription='Manage your orders form and track their status'
      pageHeaderAction={
        <Link
          href={`/dashboard/${companyId}/orders-form/new`}
          className={cn(buttonVariants(), 'text-xs md:text-sm')}
        >
          <IconPlus className='mr-2 h-4 w-4' /> Add New
        </Link>
      }
    >
      <OrdersFormListing companyId={companyId} />
    </PageContainer>
  );
}
