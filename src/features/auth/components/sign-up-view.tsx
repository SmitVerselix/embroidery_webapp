'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/providers/auth-provider';
import { getError } from '@/lib/api/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Loader2, Eye, EyeOff, Check, X } from 'lucide-react';
import { InteractiveGridPattern } from './interactive-grid';

// =============================================================================
// SCHEMA (Zod v4 compatible)
// =============================================================================

const signUpSchema = z
  .object({
    name: z
      .string()
      .min(1, 'Name is required')
      .min(2, 'Name must be at least 2 characters'),
    email: z
      .string()
      .min(1, 'Email is required')
      .email('Please enter a valid email address'),
    password: z
      .string()
      .min(1, 'Password is required')
      .min(6, 'Password must be at least 6 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(
        /[@$!%*?&]/,
        'Password must contain at least one special character (@$!%*?&)'
      ),
    confirmPassword: z.string().min(1, 'Please confirm your password')
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword']
  });

type SignUpFormData = z.infer<typeof signUpSchema>;

// =============================================================================
// PASSWORD REQUIREMENTS
// =============================================================================

const passwordRequirements = [
  { regex: /.{6,}/, label: 'At least 6 characters' },
  { regex: /[A-Z]/, label: 'One uppercase letter' },
  { regex: /[a-z]/, label: 'One lowercase letter' },
  { regex: /[0-9]/, label: 'One number' },
  { regex: /[@$!%*?&]/, label: 'One special character (@$!%*?&)' }
];

// =============================================================================
// COMPONENT
// =============================================================================

export default function SignUpViewPage() {
  const { register: registerUser, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: ''
    }
  });

  const password = watch('password', '');

  const onSubmit = async (data: SignUpFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      await registerUser(data.name, data.email, data.password);
      // Redirect is handled in AuthProvider
    } catch (err) {
      setError(getError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const loading = isLoading || authLoading;

  return (
    <div className='relative flex min-h-screen flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0'>
      {/* Right side link */}
      <Link
        href='/auth/sign-in'
        className={cn(
          'absolute top-4 right-4 md:top-8 md:right-8',
          'inline-flex items-center justify-center rounded-md text-sm font-medium',
          'ring-offset-background transition-colors',
          'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
          'hover:bg-accent hover:text-accent-foreground',
          'h-10 px-4 py-2'
        )}
      >
        Sign In
      </Link>

      {/* Left Panel - Branding */}
      <div className='bg-muted relative hidden h-full flex-col p-10 text-white lg:flex dark:border-r'>
        <div className='absolute inset-0 bg-zinc-900' />
        <div className='relative z-20 flex items-center text-lg font-medium'>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
            className='mr-2 h-6 w-6'
          >
            <path d='M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3' />
          </svg>
          Your Logo
        </div>
        <InteractiveGridPattern
          className={cn(
            'mask-[radial-gradient(400px_circle_at_center,white,transparent)]',
            'inset-x-0 inset-y-[0%] h-full skew-y-12'
          )}
        />
        <div className='relative z-20 mt-auto'>
          <blockquote className='space-y-2'>
            <p className='text-lg'>
              &ldquo;Getting started was incredibly easy. The onboarding
              experience is seamless.&rdquo;
            </p>
            <footer className='text-sm'>New User</footer>
          </blockquote>
        </div>
      </div>

      {/* Right Panel - Sign Up Form */}
      <div className='flex h-full items-center justify-center overflow-y-auto p-4 lg:p-8'>
        <div className='mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[400px]'>
          <div className='flex flex-col space-y-2 text-center'>
            <h1 className='text-2xl font-semibold tracking-tight'>
              Create an account
            </h1>
            <p className='text-muted-foreground text-sm'>
              Enter your details below to create your account
            </p>
          </div>

          <div className='grid gap-6'>
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className='grid gap-4'>
                {/* Error Message */}
                {error && (
                  <div className='bg-destructive/15 text-destructive rounded-md p-3 text-sm'>
                    {error}
                  </div>
                )}

                {/* Name Field */}
                <div className='grid gap-2'>
                  <Label htmlFor='name'>Full Name</Label>
                  <Input
                    id='name'
                    type='text'
                    placeholder='John Doe'
                    autoCapitalize='words'
                    autoComplete='name'
                    autoCorrect='off'
                    disabled={loading}
                    {...register('name')}
                    className={errors.name ? 'border-destructive' : ''}
                  />
                  {errors.name && (
                    <p className='text-destructive text-sm'>
                      {errors.name.message}
                    </p>
                  )}
                </div>

                {/* Email Field */}
                <div className='grid gap-2'>
                  <Label htmlFor='email'>Email</Label>
                  <Input
                    id='email'
                    type='email'
                    placeholder='name@example.com'
                    autoCapitalize='none'
                    autoComplete='email'
                    autoCorrect='off'
                    disabled={loading}
                    {...register('email')}
                    className={errors.email ? 'border-destructive' : ''}
                  />
                  {errors.email && (
                    <p className='text-destructive text-sm'>
                      {errors.email.message}
                    </p>
                  )}
                </div>

                {/* Password Field */}
                <div className='grid gap-2'>
                  <Label htmlFor='password'>Password</Label>
                  <div className='relative'>
                    <Input
                      id='password'
                      type={showPassword ? 'text' : 'password'}
                      placeholder='Create a password'
                      autoComplete='new-password'
                      disabled={loading}
                      {...register('password')}
                      className={
                        errors.password ? 'border-destructive pr-10' : 'pr-10'
                      }
                    />
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      className='absolute top-0 right-0 h-full px-3 py-2 hover:bg-transparent'
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={loading}
                    >
                      {showPassword ? (
                        <EyeOff className='text-muted-foreground h-4 w-4' />
                      ) : (
                        <Eye className='text-muted-foreground h-4 w-4' />
                      )}
                      <span className='sr-only'>
                        {showPassword ? 'Hide password' : 'Show password'}
                      </span>
                    </Button>
                  </div>
                  {errors.password && (
                    <p className='text-destructive text-sm'>
                      {errors.password.message}
                    </p>
                  )}

                  {/* Password Requirements */}
                  {password && (
                    <div className='mt-2 space-y-1'>
                      {passwordRequirements.map((req, index) => {
                        const isMet = req.regex.test(password);
                        return (
                          <div
                            key={index}
                            className={cn(
                              'flex items-center gap-2 text-xs',
                              isMet ? 'text-green-600' : 'text-muted-foreground'
                            )}
                          >
                            {isMet ? (
                              <Check className='h-3 w-3' />
                            ) : (
                              <X className='h-3 w-3' />
                            )}
                            {req.label}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Confirm Password Field */}
                <div className='grid gap-2'>
                  <Label htmlFor='confirmPassword'>Confirm Password</Label>
                  <div className='relative'>
                    <Input
                      id='confirmPassword'
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder='Confirm your password'
                      autoComplete='new-password'
                      disabled={loading}
                      {...register('confirmPassword')}
                      className={
                        errors.confirmPassword
                          ? 'border-destructive pr-10'
                          : 'pr-10'
                      }
                    />
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      className='absolute top-0 right-0 h-full px-3 py-2 hover:bg-transparent'
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      disabled={loading}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className='text-muted-foreground h-4 w-4' />
                      ) : (
                        <Eye className='text-muted-foreground h-4 w-4' />
                      )}
                      <span className='sr-only'>
                        {showConfirmPassword
                          ? 'Hide password'
                          : 'Show password'}
                      </span>
                    </Button>
                  </div>
                  {errors.confirmPassword && (
                    <p className='text-destructive text-sm'>
                      {errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                {/* Submit Button */}
                <Button type='submit' disabled={loading} className='w-full'>
                  {loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                  Create Account
                </Button>
              </div>
            </form>
          </div>

          {/* Sign In Link */}
          <p className='text-muted-foreground px-8 text-center text-sm'>
            Already have an account?{' '}
            <Link
              href='/auth/sign-in'
              className='hover:text-primary underline underline-offset-4'
            >
              Sign in
            </Link>
          </p>

          {/* Terms */}
          <p className='text-muted-foreground px-8 text-center text-sm'>
            By continuing, you agree to our{' '}
            <Link
              href='/terms'
              className='hover:text-primary underline underline-offset-4'
            >
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link
              href='/privacy'
              className='hover:text-primary underline underline-offset-4'
            >
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
