import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// =============================================================================
// CONFIGURATION
// =============================================================================

// const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://192.168.1.72:6565";
const API_BASE_URL = 'https://embroidery-backend-zkey.onrender.com';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// =============================================================================
// REQUEST INTERCEPTOR
// =============================================================================

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Add token to headers
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// =============================================================================
// RESPONSE INTERCEPTOR
// =============================================================================

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (typeof window !== 'undefined') {
      // Handle 401 Unauthorized
      if (error.response?.status === 401) {
        // Clear auth data
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('currentCompany');

        // Redirect to sign-in (avoid if already on auth pages)
        const isAuthPage = window.location.pathname.includes('/auth/');
        if (!isAuthPage) {
          window.location.href = '/auth/sign-in';
        }
      }

      // Handle 403 Forbidden
      if (error.response?.status === 403) {
        console.error('Access denied:', error.response.data);
      }

      // Handle 500+ Server errors
      if (error.response && error.response.status >= 500) {
        console.error('Server error:', error.response.data);
      }
    }

    return Promise.reject(error);
  }
);

// =============================================================================
// ERROR HELPER
// =============================================================================

interface ApiErrorResponse {
  success: false;
  status: number;
  message: string;
  errors?: Record<string, string[]>;
}

export const getError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const apiError = error.response?.data as ApiErrorResponse | undefined;

    // Check for API error message
    if (apiError?.message) {
      return apiError.message;
    }

    // Check for validation errors
    if (apiError?.errors) {
      const firstError = Object.values(apiError.errors)[0];
      if (firstError && firstError.length > 0) {
        return firstError[0];
      }
    }

    // Fallback to axios error message
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
};

// =============================================================================
// VALIDATION ERROR HELPER
// =============================================================================

export const getValidationErrors = (
  error: unknown
): Record<string, string[]> | null => {
  if (axios.isAxiosError(error)) {
    const apiError = error.response?.data as ApiErrorResponse | undefined;
    return apiError?.errors || null;
  }
  return null;
};

// =============================================================================
// IP ADDRESS HELPER
// =============================================================================

export const getClientIP = async (): Promise<string> => {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch {
    return '0.0.0.0';
  }
};

// =============================================================================
// FORM DATA HELPER (for file uploads)
// =============================================================================

export const createFormData = (
  data: Record<string, unknown>,
  files?: { key: string; file: File | File[] }[]
): FormData => {
  const formData = new FormData();

  // Add regular data
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (typeof value === 'object' && !(value instanceof File)) {
        formData.append(key, JSON.stringify(value));
      } else {
        formData.append(key, value as string);
      }
    }
  });

  // Add files
  if (files) {
    files.forEach(({ key, file }) => {
      if (Array.isArray(file)) {
        file.forEach((f) => formData.append(key, f));
      } else {
        formData.append(key, file);
      }
    });
  }

  return formData;
};

// =============================================================================
// EXPORT
// =============================================================================

export default api;
