'use client';

import { useParams } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import TemplateViewPage from '@/features/templates/components/template-view-page';

export default function Page() {
  const params = useParams();
  const companyId = params?.companyId as string;
  const productId = params?.productId as string;
  const templateId = params?.templateId as string;

  return (
    <PageContainer scrollable>
      <div className="flex-1 space-y-4">
        <TemplateViewPage
          companyId={companyId}
          productId={productId}
          templateId={templateId}
        />
      </div>
    </PageContainer>
  );
}