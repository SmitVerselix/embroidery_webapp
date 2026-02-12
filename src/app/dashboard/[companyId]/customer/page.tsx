import PageContainer from '@/components/layout/page-container';
import { buttonVariants } from '@/components/ui/button';
import CustomerListingPage from '@/features/customers/components/customer-listing';
import { cn } from '@/lib/utils';
import { IconPlus } from '@tabler/icons-react';
import Link from 'next/link';

export const metadata = {
  title: 'Dashboard: Customers',
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
      pageTitle="Customers"
      pageDescription="Manage your customers"
      pageHeaderAction={
        <Link
          href={`/dashboard/${companyId}/customer/new`}
          className={cn(buttonVariants(), 'text-xs md:text-sm')}
        >
          <IconPlus className="mr-2 h-4 w-4" /> Add New
        </Link>
      }
    >
      <CustomerListingPage />
    </PageContainer>
  );
}