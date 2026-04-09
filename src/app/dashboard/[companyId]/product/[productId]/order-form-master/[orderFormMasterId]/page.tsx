'use client';

import { useParams } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import OrderFormMasterViewPage from '@/features/order-form-master/components/order-form-master-view-page';

export default function Page() {
  const params = useParams();
  const companyId = params?.companyId as string;
  const productId = params?.productId as string;
  const orderFormMasterId = params?.orderFormMasterId as string;

  // If orderFormMasterId is 'new', show create form
  if (orderFormMasterId === 'new') {
    return (
      <PageContainer scrollable>
        <div className='flex-1 space-y-4'>
          <OrderFormMasterViewPage
            companyId={companyId}
            productId={productId}
            orderFormMasterId='new'
          />
        </div>
      </PageContainer>
    );
  }

  // Otherwise show view/detail page for existing order form master
  return (
    <PageContainer scrollable>
      <div className='flex-1 space-y-4'>
        <OrderFormMasterViewPage
          companyId={companyId}
          productId={productId}
          orderFormMasterId={orderFormMasterId}
        />
      </div>
    </PageContainer>
  );
}
