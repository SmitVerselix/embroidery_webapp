// =============================================================================
// API ENDPOINTS
// =============================================================================

const API_PREFIX = '/api/v1/web';

export const ENDPOINTS = {
  // Auth endpoints
  AUTH: {
    LOGIN: `${API_PREFIX}/user/auth/login`,
    REGISTER: `${API_PREFIX}/user/auth/register`,
    LOGOUT: `${API_PREFIX}/user/auth/logout`,
    ME: `${API_PREFIX}/user/auth/me`,
    FORGOT_PASSWORD: `${API_PREFIX}/user/auth/forgot-password`,
    RESET_PASSWORD: `${API_PREFIX}/user/auth/reset-password`,
    CHANGE_PASSWORD: `${API_PREFIX}/user/auth/change-password`,
    VERIFY_EMAIL: `${API_PREFIX}/user/auth/verify-email`,
    RESEND_VERIFICATION: `${API_PREFIX}/user/auth/resend-verification`
  },

  // Company endpoints
  COMPANY: {
    GET_MY_COMPANIES: `${API_PREFIX}/user/company/get-my-companies`,
    SWITCH: `${API_PREFIX}/user/company/switch`,
    CREATE: `${API_PREFIX}/user/company/create`,
    REGISTER: `${API_PREFIX}/user/company/register`,
    UPDATE: (id: string) => `${API_PREFIX}/user/company/${id}`,
    DELETE: (id: string) => `${API_PREFIX}/user/company/${id}`,
    GET_MEMBERS: (id: string) => `${API_PREFIX}/user/company/${id}/members`,
    INVITE: (id: string) => `${API_PREFIX}/user/company/${id}/invite`
  },

  // Profile endpoints
  PROFILE: {
    GET: `${API_PREFIX}/user/profile`,
    UPDATE: `${API_PREFIX}/user/profile`,
    UPLOAD_AVATAR: `${API_PREFIX}/user/profile/avatar`,
    DELETE_AVATAR: `${API_PREFIX}/user/profile/avatar`
  },

  // Dashboard endpoints
  DASHBOARD: {
    STATS: `${API_PREFIX}/dashboard/stats`,
    REVENUE: `${API_PREFIX}/dashboard/revenue`
  },

  // Product endpoints (company-scoped)
  PRODUCT: {
    LIST: (companyId: string) => `${API_PREFIX}/user/${companyId}/product/list`,
    GET: (companyId: string, productId: string) =>
      `${API_PREFIX}/user/${companyId}/product/get/${productId}`,
    CREATE: (companyId: string) =>
      `${API_PREFIX}/user/${companyId}/product/create`,
    UPDATE: (companyId: string, productId: string) =>
      `${API_PREFIX}/user/${companyId}/product/update/${productId}`,
    DELETE: (companyId: string, productId: string) =>
      `${API_PREFIX}/user/${companyId}/product/delete/${productId}`
  },

  // Template endpoints (product-scoped)
  TEMPLATE: {
    LIST: (companyId: string, productId: string) =>
      `${API_PREFIX}/user/${companyId}/product/${productId}/template/list`,
    GET: (companyId: string, productId: string, templateId: string) =>
      `${API_PREFIX}/user/${companyId}/product/${productId}/template/get/${templateId}`,
    CREATE: (companyId: string, productId: string) =>
      `${API_PREFIX}/user/${companyId}/product/${productId}/template/create`,
    UPDATE: (companyId: string, productId: string, templateId: string) =>
      `${API_PREFIX}/user/${companyId}/product/${productId}/template/update/${templateId}`,
    DELETE: (companyId: string, productId: string, templateId: string) =>
      `${API_PREFIX}/user/${companyId}/product/${productId}/template/delete/${templateId}`,
    REORDER: (companyId: string, productId: string) =>
      `${API_PREFIX}/user/${companyId}/product/${productId}/template/reorder`
  },

  // Template Column endpoints
  COLUMN: {
    CREATE: (companyId: string, productId: string, templateId: string) =>
      `${API_PREFIX}/user/${companyId}/product/${productId}/template/${templateId}/column/create`,
    UPDATE: (
      companyId: string,
      productId: string,
      templateId: string,
      columnId: string
    ) =>
      `${API_PREFIX}/user/${companyId}/product/${productId}/template/${templateId}/column/update/${columnId}`,
    DELETE: (
      companyId: string,
      productId: string,
      templateId: string,
      columnId: string
    ) =>
      `${API_PREFIX}/user/${companyId}/product/${productId}/template/${templateId}/column/delete/${columnId}`,
    REORDER: (companyId: string, productId: string, templateId: string) =>
      `${API_PREFIX}/user/${companyId}/product/${productId}/template/${templateId}/column/reorder`
  },

  // Template Row endpoints
  ROW: {
    CREATE: (companyId: string, productId: string, templateId: string) =>
      `${API_PREFIX}/user/${companyId}/product/${productId}/template/${templateId}/row/create`,
    UPDATE: (
      companyId: string,
      productId: string,
      templateId: string,
      rowId: string
    ) =>
      `${API_PREFIX}/user/${companyId}/product/${productId}/template/${templateId}/row/update/${rowId}`,
    DELETE: (
      companyId: string,
      productId: string,
      templateId: string,
      rowId: string
    ) =>
      `${API_PREFIX}/user/${companyId}/product/${productId}/template/${templateId}/row/delete/${rowId}`,
    REORDER: (companyId: string, productId: string, templateId: string) =>
      `${API_PREFIX}/user/${companyId}/product/${productId}/template/${templateId}/row/reorder`
  },

  // Template Extra endpoints
  EXTRA: {
    CREATE: (companyId: string, productId: string, templateId: string) =>
      `${API_PREFIX}/user/${companyId}/product/${productId}/template/${templateId}/extra/create`,
    UPDATE: (
      companyId: string,
      productId: string,
      templateId: string,
      extraId: string
    ) =>
      `${API_PREFIX}/user/${companyId}/product/${productId}/template/${templateId}/extra/update/${extraId}`,
    DELETE: (
      companyId: string,
      productId: string,
      templateId: string,
      extraId: string
    ) =>
      `${API_PREFIX}/user/${companyId}/product/${productId}/template/${templateId}/extra/delete/${extraId}`,
    REORDER: (companyId: string, productId: string, templateId: string) =>
      `${API_PREFIX}/user/${companyId}/product/${productId}/template/${templateId}/extra/reorder`
  },

  // Order endpoints (company-scoped)
  ORDER: {
    CREATE: (companyId: string) =>
      `${API_PREFIX}/user/${companyId}/order/create`,
    LIST: (companyId: string) => `${API_PREFIX}/user/${companyId}/order/list`,
    GET: (companyId: string, orderId: string) =>
      `${API_PREFIX}/user/${companyId}/order/get/${orderId}`,
    UPDATE_VALUES: (companyId: string, orderId: string) =>
      `${API_PREFIX}/user/${companyId}/order/update-values/${orderId}`,
    UPDATE_EXTRA_VALUES: (companyId: string, orderId: string) =>
      `${API_PREFIX}/user/${companyId}/order/update-extra-values/${orderId}`,
    RECALCULATE: (companyId: string, orderId: string) =>
      `${API_PREFIX}/user/${companyId}/order/recalculate/${orderId}`,
    UPDATE_FINAL_CALCULATION: (companyId: string, orderId: string) =>
      `${API_PREFIX}/user/${companyId}/order/update-final-calculation/${orderId}`,
    HISTORY: (companyId: string, orderId: string) =>
      `${API_PREFIX}/user/${companyId}/order/${orderId}/history`
  },

  // Upload endpoints
  UPLOAD: {
    SINGLE: `${API_PREFIX}/user/upload/upload-single`
  },

  // Customer endpoints (company-scoped)
  CUSTOMER: {
    LIST: (companyId: string) =>
      `${API_PREFIX}/user/${companyId}/customer/list`,
    GET: (companyId: string, customerId: string) =>
      `${API_PREFIX}/user/${companyId}/customer/get/${customerId}`,
    CREATE: (companyId: string) =>
      `${API_PREFIX}/user/${companyId}/customer/create`,
    UPDATE: (companyId: string, customerId: string) =>
      `${API_PREFIX}/user/${companyId}/customer/update/${customerId}`,
    DELETE: (companyId: string, customerId: string) =>
      `${API_PREFIX}/user/${companyId}/customer/delete/${customerId}`
  },

  // Member endpoints (company-scoped)
  MEMBER: {
    LIST: (companyId: string) =>
      `${API_PREFIX}/user/company/${companyId}/members/list`,
    INVITE: (companyId: string) =>
      `${API_PREFIX}/user/company/${companyId}/members/invite`,
    ACCEPT_INVITE: `${API_PREFIX}/user/company/members/accept-invite`
  },

  // Login history endpoints
  LOGIN_HISTORY: {
    LIST: `${API_PREFIX}/user/login-history`
  }
} as const;

// =============================================================================
// QUERY KEYS (for React Query)
// =============================================================================

export const QUERY_KEYS = {
  ME: ['auth', 'me'] as const,
  MY_COMPANIES: ['companies', 'my'] as const,
  COMPANY: (id: string) => ['companies', id] as const,
  COMPANY_MEMBERS: (id: string) => ['companies', id, 'members'] as const,
  PROFILE: ['profile'] as const,
  DASHBOARD_STATS: ['dashboard', 'stats'] as const,
  PRODUCTS: (companyId: string) => ['products', companyId] as const,
  PRODUCT: (companyId: string, productId: string) =>
    ['products', companyId, productId] as const,
  TEMPLATES: (companyId: string, productId: string) =>
    ['templates', companyId, productId] as const,
  TEMPLATE: (companyId: string, productId: string, templateId: string) =>
    ['templates', companyId, productId, templateId] as const,
  TEMPLATE_COLUMNS: (
    companyId: string,
    productId: string,
    templateId: string
  ) => ['templates', companyId, productId, templateId, 'columns'] as const,
  TEMPLATE_ROWS: (companyId: string, productId: string, templateId: string) =>
    ['templates', companyId, productId, templateId, 'rows'] as const,
  TEMPLATE_EXTRAS: (companyId: string, productId: string, templateId: string) =>
    ['templates', companyId, productId, templateId, 'extras'] as const,
  ORDERS: (companyId: string) => ['orders', companyId] as const,
  ORDER: (companyId: string, orderId: string) =>
    ['orders', companyId, orderId] as const,
  ORDER_HISTORY: (companyId: string, orderId: string) =>
    ['orders', companyId, orderId, 'history'] as const,
  CUSTOMERS: (companyId: string) => ['customers', companyId] as const,
  CUSTOMER: (companyId: string, customerId: string) =>
    ['customers', companyId, customerId] as const,
  MEMBERS: (companyId: string) => ['members', companyId] as const,
  LOGIN_HISTORY: ['login-history'] as const
} as const;
