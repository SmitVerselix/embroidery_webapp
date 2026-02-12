'use client';

import { useParams } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import TemplateViewPage from '@/features/templates/components/template-view-page';
import { TemplateBuilder } from '@/features/templates/components/template-builder';

export default function Page() {
  const params = useParams();
  const companyId = params?.companyId as string;
  const productId = params?.productId as string;
  const templateId = params?.templateId as string;

  // If templateId is 'new', show create form
  if (templateId === 'new') {
    return (
      <PageContainer scrollable>
        <div className="flex-1 space-y-4">
          <TemplateViewPage
            companyId={companyId}
            productId={productId}
            templateId="new"
          />
        </div>
      </PageContainer>
    );
  }

  // Otherwise show template builder
  return (
    <PageContainer scrollable>
      <div className="flex-1 space-y-4">
        <TemplateBuilder
          companyId={companyId}
          productId={productId}
          templateId={templateId}
        />
      </div>
    </PageContainer>
  );
}