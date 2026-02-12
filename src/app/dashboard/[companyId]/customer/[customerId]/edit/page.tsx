'use client';

import { useParams } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import CustomerViewPage from '@/features/customers/components/customer-view-page';

export default function Page() {
  const params = useParams();
  const customerId = params?.customerId as string;

  return (
    <PageContainer scrollable>
      <div className="flex-1 space-y-4">
        <CustomerViewPage customerId={customerId} />
      </div>
    </PageContainer>
  );
}