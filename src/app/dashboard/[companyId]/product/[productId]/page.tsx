import PageContainer from '@/components/layout/page-container';
import ProductDetailPage from '@/features/products/components/product-detail-page';
import ProductViewPage from '@/features/products/components/product-view-page';

export const metadata = {
  title: 'Dashboard: Product',
};

type PageProps = {
  params: Promise<{ companyId: string; productId: string }>;
};

export default async function Page(props: PageProps) {
  const params = await props.params;
  const { companyId, productId } = params;

  // If productId is 'new', show create form
  if (productId === 'new') {
    return (
      <PageContainer scrollable>
        <div className="flex-1 space-y-4">
          <ProductViewPage productId="new" />
        </div>
      </PageContainer>
    );
  }

  // Otherwise show product detail with templates
  return (
    <PageContainer scrollable>
      <div className="flex-1 space-y-4">
        <ProductDetailPage companyId={companyId} productId={productId} />
      </div>
    </PageContainer>
  );
}