'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { acceptInvite } from '@/lib/api/services';
import { getError } from '@/lib/api/axios';
import type { AcceptInvitePayload } from '@/lib/api/types';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Loader2, CheckCircle2, XCircle, UserPlus } from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

type PageStatus = 'idle' | 'accepting' | 'success' | 'error' | 'invalid-token';

// =============================================================================
// COMPONENT
// =============================================================================

export default function AcceptInvitePage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const token = searchParams.get('token');

  const [status, setStatus] = useState<PageStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<AcceptInvitePayload | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(
    null
  );

  // Validate token on mount
  useEffect(() => {
    if (!token || token.trim() === '') {
      setStatus('invalid-token');
    }
  }, [token]);

  // Countdown timer for auto-redirect
  useEffect(() => {
    if (redirectCountdown === null || redirectCountdown <= 0) return;

    const timer = setTimeout(() => {
      setRedirectCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [redirectCountdown]);

  // Auto-redirect when countdown hits 0
  useEffect(() => {
    if (redirectCountdown === 0 && payload) {
      const isRegistered = payload.membership.user.isRegistrationCompleted;
      if (isRegistered) {
        router.push('/auth/sign-in');
      } else {
        router.push('/auth/sign-up');
      }
    }
  }, [redirectCountdown, payload, router]);

  // Handle accept invite
  const handleAcceptInvite = useCallback(async () => {
    if (!token) {
      setStatus('invalid-token');
      return;
    }

    setStatus('accepting');
    setError(null);

    try {
      const result = await acceptInvite({ token });
      setPayload(result);
      setStatus('success');
      setRedirectCountdown(5);
    } catch (err) {
      setError(getError(err));
      setStatus('error');
    }
  }, [token]);

  // Handle manual redirect
  const handleRedirect = useCallback(() => {
    if (!payload) return;

    const isRegistered = payload.membership.user.isRegistrationCompleted;
    if (isRegistered) {
      router.push('/auth/sign-in');
    } else {
      router.push('/auth/sign-up');
    }
  }, [payload, router]);

  // =========================================================================
  // RENDER: Invalid Token
  // =========================================================================

  if (status === 'invalid-token') {
    return (
      <div className='bg-background flex min-h-screen items-center justify-center px-4'>
        <Card className='w-full max-w-md'>
          <CardHeader className='text-center'>
            <div className='bg-destructive/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full'>
              <XCircle className='text-destructive h-8 w-8' />
            </div>
            <CardTitle className='text-xl'>Invalid Invitation Link</CardTitle>
            <CardDescription>
              This invitation link is missing a valid token. Please check the
              link you received in your email and try again.
            </CardDescription>
          </CardHeader>
          <CardFooter className='justify-center'>
            <Button
              variant='outline'
              onClick={() => router.push('/auth/sign-in')}
            >
              Go to Sign In
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // =========================================================================
  // RENDER: Main
  // =========================================================================

  return (
    <div className='bg-background flex min-h-screen items-center justify-center px-4'>
      <Card className='w-full max-w-md'>
        {/* ---- IDLE STATE ---- */}
        {status === 'idle' && (
          <>
            <CardHeader className='text-center'>
              <div className='bg-primary/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full'>
                <UserPlus className='text-primary h-8 w-8' />
              </div>
              <CardTitle className='text-xl'>
                You&apos;ve Been Invited!
              </CardTitle>
              <CardDescription>
                You have been invited to join a company. Click the button below
                to accept the invitation and get started.
              </CardDescription>
            </CardHeader>
            <CardFooter className='justify-center'>
              <Button onClick={handleAcceptInvite} className='w-full'>
                <UserPlus className='mr-2 h-4 w-4' />
                Accept Invitation
              </Button>
            </CardFooter>
          </>
        )}

        {/* ---- ACCEPTING STATE ---- */}
        {status === 'accepting' && (
          <CardContent className='flex flex-col items-center gap-4 py-12'>
            <Loader2 className='text-primary h-10 w-10 animate-spin' />
            <p className='text-muted-foreground text-sm'>
              Accepting your invitation...
            </p>
          </CardContent>
        )}

        {/* ---- SUCCESS STATE ---- */}
        {status === 'success' && payload && (
          <>
            <CardHeader className='text-center'>
              <div className='mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20'>
                <CheckCircle2 className='h-8 w-8 text-green-600 dark:text-green-400' />
              </div>
              <CardTitle className='text-xl'>Invitation Accepted!</CardTitle>
              <CardDescription>
                {payload.membership.user.isRegistrationCompleted ? (
                  <>
                    Your invitation has been accepted successfully. Please sign
                    in to access your new company.
                  </>
                ) : (
                  <>
                    Your invitation has been accepted successfully. Please
                    complete your registration to get started.
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className='text-center'>
              <p className='text-muted-foreground text-xs'>
                Redirecting in {redirectCountdown}{' '}
                {redirectCountdown === 1 ? 'second' : 'seconds'}...
              </p>
            </CardContent>
            <CardFooter className='justify-center'>
              <Button onClick={handleRedirect} className='w-full'>
                {payload.membership.user.isRegistrationCompleted
                  ? 'Go to Sign In'
                  : 'Complete Registration'}
              </Button>
            </CardFooter>
          </>
        )}

        {/* ---- ERROR STATE ---- */}
        {status === 'error' && (
          <>
            <CardHeader className='text-center'>
              <div className='bg-destructive/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full'>
                <XCircle className='text-destructive h-8 w-8' />
              </div>
              <CardTitle className='text-xl'>Something Went Wrong</CardTitle>
              <CardDescription>
                {error || 'Failed to accept the invitation. Please try again.'}
              </CardDescription>
            </CardHeader>
            <CardFooter className='flex justify-center gap-3'>
              <Button
                variant='outline'
                onClick={() => router.push('/auth/sign-in')}
              >
                Go to Sign In
              </Button>
              <Button
                onClick={() => {
                  setStatus('idle');
                  setError(null);
                }}
              >
                Try Again
              </Button>
            </CardFooter>
          </>
        )}
      </Card>
    </div>
  );
}
