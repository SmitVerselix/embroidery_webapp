'use client';

import PageContainer from '@/components/layout/page-container';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { useAuth } from '@/providers/auth-provider';
import { BadgeCheck, Lock, Sparkles, Star, Trophy } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

// =============================================================================
// PROTECTED CONTENT COMPONENT
// =============================================================================

interface ProtectedContentProps {
  requiredPlan?: string;
  requiredRole?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

function ProtectedContent({
  requiredPlan,
  requiredRole,
  children,
  fallback
}: ProtectedContentProps) {
  const { currentCompany, isAdmin, hasRole } = useAuth();

  // Check if user has access
  const hasAccess = (() => {
    // Admin always has access
    if (isAdmin()) return true;

    // Check role if required
    if (requiredRole && !hasRole(requiredRole)) return false;

    // For plan-based access, you would check against your subscription data
    // For now, we'll use a placeholder - implement based on your billing system
    if (requiredPlan) {
      // TODO: Check user's actual plan from your billing system
      // const userPlan = currentCompany?.subscription?.plan;
      // return userPlan === requiredPlan || userPlan === 'enterprise';
      return false; // Default to no access for demo
    }

    return true;
  })();

  if (!hasAccess) {
    return fallback || null;
  }

  return <>{children}</>;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function ExclusivePage() {
  const { currentCompany, isLoading, isAdmin } = useAuth();

  // For demo purposes - in production, check actual subscription
  const hasPro = isAdmin(); // Admin gets access, others need Pro plan

  return (
    <PageContainer isloading={isLoading}>
      {!hasPro ? (
        // Fallback for non-Pro users
        <div className='flex h-full min-h-[400px] items-center justify-center'>
          <Alert className='max-w-md'>
            <Lock className='h-5 w-5 text-yellow-600' />
            <AlertDescription>
              <div className='mb-1 text-lg font-semibold'>
                Pro Plan Required
              </div>
              <div className='text-muted-foreground'>
                This page is only available to companies on the{' '}
                <span className='font-semibold'>Pro</span> plan.
                <br />
                Upgrade your subscription in{' '}
                <Link className='underline' href='/dashboard/billing'>
                  Billing &amp; Plans
                </Link>
                .
              </div>
              <Button asChild className='mt-4'>
                <Link href='/dashboard/billing'>
                  <Sparkles className='mr-2 h-4 w-4' />
                  Upgrade to Pro
                </Link>
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      ) : (
        // Pro content
        <div className='space-y-6'>
          <div>
            <h1 className='flex items-center gap-2 text-3xl font-bold tracking-tight'>
              <BadgeCheck className='h-7 w-7 text-green-600' />
              Exclusive Area
            </h1>
            <p className='text-muted-foreground'>
              Welcome,{' '}
              <span className='font-semibold'>
                {currentCompany?.company?.name || 'User'}
              </span>
              ! This page contains exclusive features for Pro plan members.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Trophy className='h-5 w-5 text-yellow-500' />
                Thank You for Being a Pro Member
              </CardTitle>
              <CardDescription>
                You have access to all exclusive features and content.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='text-lg'>Have a wonderful day!</div>
            </CardContent>
          </Card>

          {/* Pro Features Grid */}
          <div className='grid gap-4 md:grid-cols-3'>
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2 text-base'>
                  <Star className='h-4 w-4 text-yellow-500' />
                  Advanced Analytics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className='text-sm text-muted-foreground'>
                  Access detailed insights and reports about your team's
                  performance.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2 text-base'>
                  <Star className='h-4 w-4 text-yellow-500' />
                  Priority Support
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className='text-sm text-muted-foreground'>
                  Get faster response times and dedicated support channels.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2 text-base'>
                  <Star className='h-4 w-4 text-yellow-500' />
                  Custom Integrations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className='text-sm text-muted-foreground'>
                  Connect with your favorite tools and build custom workflows.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </PageContainer>
  );
}