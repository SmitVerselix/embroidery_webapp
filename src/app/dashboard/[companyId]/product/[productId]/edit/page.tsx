import PageContainer from '@/components/layout/page-container';
import ProductViewPage from '@/features/products/components/product-view-page';

export const metadata = {
  title: 'Dashboard: Edit Product',
};

type PageProps = {
  params: Promise<{ companyId: string; productId: string }>;
};

export default async function Page(props: PageProps) {
  const params = await props.params;
  const { productId } = params;

  return (
    <PageContainer scrollable>
      <div className="flex-1 space-y-4">
        <ProductViewPage productId={productId} />
      </div>
    </PageContainer>
  );
}