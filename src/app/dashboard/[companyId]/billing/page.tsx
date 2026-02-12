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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, Check, Zap, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { billingInfoContent } from '@/config/infoconfig';
import { cn } from '@/lib/utils';

// =============================================================================
// PRICING PLANS
// =============================================================================

const plans = [
  {
    name: 'Free',
    description: 'For individuals and small teams getting started',
    price: '$0',
    period: '/month',
    features: [
      'Up to 3 team members',
      '5 GB storage',
      'Basic analytics',
      'Email support',
      'API access'
    ],
    buttonText: 'Current Plan',
    buttonVariant: 'outline' as const,
    popular: false
  },
  {
    name: 'Pro',
    description: 'For growing teams that need more power',
    price: '$29',
    period: '/month',
    features: [
      'Up to 20 team members',
      '100 GB storage',
      'Advanced analytics',
      'Priority support',
      'API access',
      'Custom integrations',
      'Audit logs'
    ],
    buttonText: 'Upgrade to Pro',
    buttonVariant: 'default' as const,
    popular: true
  },
  {
    name: 'Enterprise',
    description: 'For large organizations with custom needs',
    price: 'Custom',
    period: '',
    features: [
      'Unlimited team members',
      'Unlimited storage',
      'Enterprise analytics',
      'Dedicated support',
      'API access',
      'Custom integrations',
      'Audit logs',
      'SSO/SAML',
      'SLA guarantee'
    ],
    buttonText: 'Contact Sales',
    buttonVariant: 'outline' as const,
    popular: false
  }
];

// =============================================================================
// COMPONENT
// =============================================================================

export default function BillingPage() {
  const { currentCompany, isLoading } = useAuth();

  const handleUpgrade = (planName: string) => {
    // TODO: Implement your payment/upgrade logic here
    console.log(`Upgrading to ${planName}`);
    alert(`Upgrade to ${planName} - Implement your payment integration here`);
  };

  return (
    <PageContainer
      isloading={isLoading}
      access={!!currentCompany}
      accessFallback={
        <div className='flex min-h-[400px] items-center justify-center'>
          <div className='space-y-2 text-center'>
            <h2 className='text-2xl font-semibold'>No Company Selected</h2>
            <p className='text-muted-foreground'>
              Please select or create a company to view billing information.
            </p>
          </div>
        </div>
      }
      infoContent={billingInfoContent}
      pageTitle='Billing & Plans'
      pageDescription={`Manage your subscription and usage limits for ${currentCompany?.company?.name || 'your company'}`}
    >
      <div className='space-y-6'>
        {/* Info Alert */}
        <Alert>
          <Info className='h-4 w-4' />
          <AlertDescription>
            Subscribe to a plan to unlock features and higher limits. Contact
            support if you need help choosing the right plan.
          </AlertDescription>
        </Alert>

        {/* Current Plan */}
        <Card>
          <CardHeader>
            <CardTitle>Current Plan</CardTitle>
            <CardDescription>
              Your company is currently on the Free plan
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-2xl font-bold'>Free</p>
                <p className='text-sm text-muted-foreground'>
                  Basic features for small teams
                </p>
              </div>
              <Button variant='outline'>Manage Subscription</Button>
            </div>
          </CardContent>
        </Card>

        {/* Pricing Table */}
        <Card>
          <CardHeader>
            <CardTitle>Available Plans</CardTitle>
            <CardDescription>
              Choose a plan that fits your company's needs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='grid gap-6 md:grid-cols-3'>
              {plans.map((plan) => (
                <div
                  key={plan.name}
                  className={cn(
                    'relative rounded-lg border p-6',
                    plan.popular && 'border-primary shadow-md'
                  )}
                >
                  {plan.popular && (
                    <div className='absolute -top-3 left-1/2 -translate-x-1/2'>
                      <span className='inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground'>
                        <Zap className='h-3 w-3' />
                        Most Popular
                      </span>
                    </div>
                  )}

                  <div className='space-y-4'>
                    <div>
                      <h3 className='flex items-center gap-2 text-lg font-semibold'>
                        {plan.name === 'Enterprise' && (
                          <Crown className='h-5 w-5 text-yellow-500' />
                        )}
                        {plan.name}
                      </h3>
                      <p className='text-sm text-muted-foreground'>
                        {plan.description}
                      </p>
                    </div>

                    <div className='flex items-baseline'>
                      <span className='text-3xl font-bold'>{plan.price}</span>
                      <span className='text-muted-foreground'>{plan.period}</span>
                    </div>

                    <ul className='space-y-2'>
                      {plan.features.map((feature) => (
                        <li key={feature} className='flex items-center gap-2 text-sm'>
                          <Check className='h-4 w-4 text-green-500' />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    <Button
                      variant={plan.buttonVariant}
                      className='w-full'
                      onClick={() => handleUpgrade(plan.name)}
                      disabled={plan.name === 'Free'}
                    >
                      {plan.buttonText}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Usage Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Usage This Month</CardTitle>
            <CardDescription>
              Track your usage against your plan limits
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='grid gap-4 md:grid-cols-3'>
              <div className='space-y-2'>
                <p className='text-sm font-medium'>Team Members</p>
                <p className='text-2xl font-bold'>2 / 3</p>
                <div className='h-2 rounded-full bg-muted'>
                  <div className='h-full w-2/3 rounded-full bg-primary' />
                </div>
              </div>
              <div className='space-y-2'>
                <p className='text-sm font-medium'>Storage Used</p>
                <p className='text-2xl font-bold'>1.2 GB / 5 GB</p>
                <div className='h-2 rounded-full bg-muted'>
                  <div className='h-full w-1/4 rounded-full bg-primary' />
                </div>
              </div>
              <div className='space-y-2'>
                <p className='text-sm font-medium'>API Calls</p>
                <p className='text-2xl font-bold'>4,521 / 10,000</p>
                <div className='h-2 rounded-full bg-muted'>
                  <div className='h-full w-1/2 rounded-full bg-primary' />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}