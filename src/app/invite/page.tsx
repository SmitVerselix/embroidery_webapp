import { Suspense } from 'react';
import AcceptInvitePage from './accept-invite-page';

export const metadata = {
  title: 'Accept Invitation'
};

export default function InvitePage() {
  return (
    <Suspense
      fallback={
        <div className='flex min-h-screen items-center justify-center'>
          <div className='border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent' />
        </div>
      }
    >
      <AcceptInvitePage />
    </Suspense>
  );
}
