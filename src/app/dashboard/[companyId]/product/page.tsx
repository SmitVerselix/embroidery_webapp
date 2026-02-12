import PageContainer from '@/components/layout/page-container';
import { buttonVariants } from '@/components/ui/button';
import ProductListingPage from '@/features/products/components/product-listing';
import { cn } from '@/lib/utils';
import { IconPlus } from '@tabler/icons-react';
import Link from 'next/link';

export const metadata = {
  title: 'Dashboard: Products',
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
      pageTitle="Products"
      pageDescription="Manage your products"
      pageHeaderAction={
        <Link
          href={`/dashboard/${companyId}/product/new`}
          className={cn(buttonVariants(), 'text-xs md:text-sm')}
        >
          <IconPlus className="mr-2 h-4 w-4" /> Add New
        </Link>
      }
    >
      <ProductListingPage />
    </PageContainer>
  );
}