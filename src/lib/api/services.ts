import api, { getClientIP } from './axios';
import { ENDPOINTS } from './endpoints';
import type {
  User,
  AuthResponse,
  AuthPayload,
  ApiResponse,
  CompanyListResponse,
  CompanyListParams,
  UserCompany,
  Company,
  CompanyResponse,
  Product,
  ProductListResponse,
  ProductListParams,
  CreateProductData,
  UpdateProductData,
  Template,
  TemplateWithDetails,
  TemplateListResponse,
  TemplateListParams,
  CreateTemplateData,
  UpdateTemplateData,
  ReorderTemplateData,
  TemplateColumn,
  CreateColumnData,
  UpdateColumnData,
  ReorderColumnData,
  TemplateRow,
  CreateRowData,
  UpdateRowData,
  ReorderRowData,
  TemplateExtra,
  CreateExtraData,
  UpdateExtraData,
  ReorderExtraData,
  Order,
  OrderWithDetails,
  OrderListResponse,
  OrderListParams,
  CreateOrderData,
  UpdateOrderValuesData,
  UpdateOrderExtraValuesData,
  UploadResponse,
  Customer,
  CreateCustomerData,
  UpdateCustomerData,
  CustomerListParams,
  CustomerListResponse,
  Member,
  MemberListResponse,
  MemberListParams,
  InviteMemberData,
  InviteMemberResponse,
  AcceptInviteData,
  AcceptInvitePayload,
  LoginHistoryParams,
  LoginHistoryPayload,
  UpdateFinalCalculationData
} from './types';

// =============================================================================
// AUTH SERVICES
// =============================================================================

export const login = async (
  email: string,
  password: string
): Promise<AuthPayload> => {
  const ipAddress = await getClientIP();

  const data = {
    email,
    password,
    deviceType: 'web',
    ipAddress
  };

  const res = await api.post<AuthResponse>(ENDPOINTS.AUTH.LOGIN, data);

  if (res.data.success && res.data.payload) {
    const { token, user } = res.data.payload;

    if (typeof window !== 'undefined') {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    }

    return res.data.payload;
  }

  throw new Error(res.data.message || 'Login failed');
};

export const register = async (
  name: string,
  email: string,
  password: string,
  roleId?: string
): Promise<AuthPayload> => {
  const ipAddress = await getClientIP();

  const data = {
    name,
    email,
    password,
    deviceType: 'web',
    ipAddress,
    ...(roleId && { roleId })
  };

  const res = await api.post<AuthResponse>(ENDPOINTS.AUTH.REGISTER, data);

  if (res.data.success && res.data.payload) {
    const { token, user } = res.data.payload;

    if (typeof window !== 'undefined') {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    }

    return res.data.payload;
  }

  throw new Error(res.data.message || 'Registration failed');
};

export const logout = async (): Promise<void> => {
  try {
    await api.post(ENDPOINTS.AUTH.LOGOUT);
  } finally {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('currentCompany');
      localStorage.removeItem('companies');
    }
  }
};

export const getMe = async (): Promise<User> => {
  const res = await api.get<ApiResponse<User>>(ENDPOINTS.AUTH.ME);
  return res.data.payload;
};

export const forgotPassword = async (email: string): Promise<void> => {
  await api.post(ENDPOINTS.AUTH.FORGOT_PASSWORD, { email });
};

export const resetPassword = async (
  token: string,
  password: string
): Promise<void> => {
  await api.post(ENDPOINTS.AUTH.RESET_PASSWORD, { token, password });
};

export const changePassword = async (
  currentPassword: string,
  newPassword: string
): Promise<void> => {
  await api.post(ENDPOINTS.AUTH.CHANGE_PASSWORD, {
    currentPassword,
    newPassword
  });
};

// =============================================================================
// COMPANY SERVICES
// =============================================================================

export const getMyCompanies = async (
  params?: CompanyListParams
): Promise<CompanyListResponse> => {
  const defaultParams: CompanyListParams = {
    page: 1,
    limit: 10,
    sortBy: 'createdAt',
    sortOrder: 'DESC',
    search: '',
    ...params
  };

  const res = await api.post<ApiResponse<CompanyListResponse>>(
    ENDPOINTS.COMPANY.GET_MY_COMPANIES,
    defaultParams
  );

  return res.data.payload;
};

export const switchCompany = async (companyId: string): Promise<void> => {
  await api.post(ENDPOINTS.COMPANY.SWITCH, { companyId });
};

export const createCompany = async (data: {
  name: string;
  code: string;
}): Promise<UserCompany> => {
  const res = await api.post<ApiResponse<UserCompany>>(
    ENDPOINTS.COMPANY.CREATE,
    data
  );
  return res.data.payload;
};

export const registerCompany = async (data: {
  name: string;
  code: string;
}): Promise<CompanyResponse> => {
  const res = await api.post<ApiResponse<CompanyResponse>>(
    ENDPOINTS.COMPANY.REGISTER,
    data
  );
  return res.data.payload;
};

// =============================================================================
// USER SERVICES
// =============================================================================

export const updateProfile = async (data: {
  name?: string;
  mobile?: string;
  bio?: string;
}): Promise<User> => {
  const res = await api.patch<ApiResponse<User>>(
    ENDPOINTS.PROFILE.UPDATE,
    data
  );
  return res.data.payload;
};

export const uploadAvatar = async (file: File): Promise<{ url: string }> => {
  const formData = new FormData();
  formData.append('avatar', file);

  const res = await api.post<ApiResponse<{ url: string }>>(
    ENDPOINTS.PROFILE.UPLOAD_AVATAR,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }
  );
  return res.data.payload;
};

export const deleteAvatar = async (): Promise<void> => {
  await api.delete(ENDPOINTS.PROFILE.DELETE_AVATAR);
};

// =============================================================================
// PRODUCT SERVICES
// =============================================================================

export const getProducts = async (
  companyId: string,
  params?: ProductListParams
): Promise<ProductListResponse> => {
  const defaultParams: ProductListParams = {
    page: 1,
    limit: 10,
    sortBy: 'createdAt',
    sortOrder: 'DESC',
    search: '',
    ...params
  };

  const res = await api.post<ApiResponse<ProductListResponse>>(
    ENDPOINTS.PRODUCT.LIST(companyId),
    defaultParams
  );

  return res.data.payload;
};

export const getProduct = async (
  companyId: string,
  productId: string
): Promise<Product> => {
  const res = await api.get<ApiResponse<Product>>(
    ENDPOINTS.PRODUCT.GET(companyId, productId)
  );
  return res.data.payload;
};

export const createProduct = async (
  companyId: string,
  data: CreateProductData
): Promise<Product> => {
  const res = await api.post<ApiResponse<Product>>(
    ENDPOINTS.PRODUCT.CREATE(companyId),
    data
  );
  return res.data.payload;
};

export const updateProduct = async (
  companyId: string,
  productId: string,
  data: UpdateProductData
): Promise<void> => {
  await api.put<ApiResponse<number[]>>(
    ENDPOINTS.PRODUCT.UPDATE(companyId, productId),
    data
  );
};

export const deleteProduct = async (
  companyId: string,
  productId: string
): Promise<void> => {
  await api.delete<ApiResponse<number[]>>(
    ENDPOINTS.PRODUCT.DELETE(companyId, productId)
  );
};

// =============================================================================
// TEMPLATE SERVICES
// =============================================================================

export const getTemplates = async (
  companyId: string,
  productId: string,
  params?: TemplateListParams
): Promise<TemplateListResponse> => {
  const defaultParams: TemplateListParams = {
    page: 1,
    limit: 10,
    sortBy: 'createdAt',
    sortOrder: 'DESC',
    search: '',
    ...params
  };

  const res = await api.post<ApiResponse<TemplateListResponse>>(
    ENDPOINTS.TEMPLATE.LIST(companyId, productId),
    defaultParams
  );

  return res.data.payload;
};

export const getTemplate = async (
  companyId: string,
  productId: string,
  templateId: string
): Promise<TemplateWithDetails> => {
  const res = await api.get<ApiResponse<TemplateWithDetails>>(
    ENDPOINTS.TEMPLATE.GET(companyId, productId, templateId)
  );
  return res.data.payload;
};

export const createTemplate = async (
  companyId: string,
  productId: string,
  data: CreateTemplateData
): Promise<Template> => {
  const res = await api.post<ApiResponse<Template>>(
    ENDPOINTS.TEMPLATE.CREATE(companyId, productId),
    data
  );
  return res.data.payload;
};

export const updateTemplate = async (
  companyId: string,
  productId: string,
  templateId: string,
  data: UpdateTemplateData
): Promise<void> => {
  await api.put<ApiResponse<number[]>>(
    ENDPOINTS.TEMPLATE.UPDATE(companyId, productId, templateId),
    data
  );
};

export const deleteTemplate = async (
  companyId: string,
  productId: string,
  templateId: string
): Promise<void> => {
  await api.delete<ApiResponse<number[]>>(
    ENDPOINTS.TEMPLATE.DELETE(companyId, productId, templateId)
  );
};

export const reorderTemplates = async (
  companyId: string,
  productId: string,
  data: ReorderTemplateData
): Promise<void> => {
  await api.put<ApiResponse<void>>(
    ENDPOINTS.TEMPLATE.REORDER(companyId, productId),
    data
  );
};

// =============================================================================
// TEMPLATE COLUMN SERVICES
// =============================================================================

export const createColumn = async (
  companyId: string,
  productId: string,
  templateId: string,
  data: CreateColumnData
): Promise<TemplateColumn> => {
  const res = await api.post<ApiResponse<TemplateColumn>>(
    ENDPOINTS.COLUMN.CREATE(companyId, productId, templateId),
    data
  );
  return res.data.payload;
};

export const updateColumn = async (
  companyId: string,
  productId: string,
  templateId: string,
  columnId: string,
  data: UpdateColumnData
): Promise<void> => {
  await api.put<ApiResponse<number[]>>(
    ENDPOINTS.COLUMN.UPDATE(companyId, productId, templateId, columnId),
    data
  );
};

export const deleteColumn = async (
  companyId: string,
  productId: string,
  templateId: string,
  columnId: string
): Promise<void> => {
  await api.delete<ApiResponse<number[]>>(
    ENDPOINTS.COLUMN.DELETE(companyId, productId, templateId, columnId)
  );
};

export const reorderColumns = async (
  companyId: string,
  productId: string,
  templateId: string,
  data: ReorderColumnData
): Promise<void> => {
  await api.put<ApiResponse<void>>(
    ENDPOINTS.COLUMN.REORDER(companyId, productId, templateId),
    data
  );
};

// =============================================================================
// TEMPLATE ROW SERVICES
// =============================================================================

export const createRow = async (
  companyId: string,
  productId: string,
  templateId: string,
  data: CreateRowData
): Promise<TemplateRow> => {
  const res = await api.post<ApiResponse<TemplateRow>>(
    ENDPOINTS.ROW.CREATE(companyId, productId, templateId),
    data
  );
  return res.data.payload;
};

export const updateRow = async (
  companyId: string,
  productId: string,
  templateId: string,
  rowId: string,
  data: UpdateRowData
): Promise<void> => {
  await api.put<ApiResponse<number[]>>(
    ENDPOINTS.ROW.UPDATE(companyId, productId, templateId, rowId),
    data
  );
};

export const deleteRow = async (
  companyId: string,
  productId: string,
  templateId: string,
  rowId: string
): Promise<void> => {
  await api.delete<ApiResponse<number[]>>(
    ENDPOINTS.ROW.DELETE(companyId, productId, templateId, rowId)
  );
};

export const reorderRows = async (
  companyId: string,
  productId: string,
  templateId: string,
  data: ReorderRowData
): Promise<void> => {
  await api.put<ApiResponse<void>>(
    ENDPOINTS.ROW.REORDER(companyId, productId, templateId),
    data
  );
};

// =============================================================================
// TEMPLATE EXTRA SERVICES
// =============================================================================

export const createExtra = async (
  companyId: string,
  productId: string,
  templateId: string,
  data: CreateExtraData
): Promise<TemplateExtra> => {
  const res = await api.post<ApiResponse<TemplateExtra>>(
    ENDPOINTS.EXTRA.CREATE(companyId, productId, templateId),
    data
  );
  return res.data.payload;
};

export const updateExtra = async (
  companyId: string,
  productId: string,
  templateId: string,
  extraId: string,
  data: UpdateExtraData
): Promise<void> => {
  await api.put<ApiResponse<number[]>>(
    ENDPOINTS.EXTRA.UPDATE(companyId, productId, templateId, extraId),
    data
  );
};

export const deleteExtra = async (
  companyId: string,
  productId: string,
  templateId: string,
  extraId: string
): Promise<void> => {
  await api.delete<ApiResponse<number[]>>(
    ENDPOINTS.EXTRA.DELETE(companyId, productId, templateId, extraId)
  );
};

export const reorderExtras = async (
  companyId: string,
  productId: string,
  templateId: string,
  data: ReorderExtraData
): Promise<void> => {
  await api.put<ApiResponse<void>>(
    ENDPOINTS.EXTRA.REORDER(companyId, productId, templateId),
    data
  );
};

// =============================================================================
// ORDER SERVICES
// =============================================================================

export const getOrders = async (
  companyId: string,
  params?: OrderListParams
): Promise<OrderListResponse> => {
  const defaultParams: OrderListParams = {
    page: 1,
    limit: 10,
    sortBy: 'createdAt',
    sortOrder: 'DESC',
    search: '',
    ...params
  };

  const res = await api.post<ApiResponse<OrderListResponse>>(
    ENDPOINTS.ORDER.LIST(companyId),
    defaultParams
  );

  return res.data.payload;
};

export const getOrder = async (
  companyId: string,
  orderId: string
): Promise<OrderWithDetails> => {
  const res = await api.get<ApiResponse<OrderWithDetails>>(
    ENDPOINTS.ORDER.GET(companyId, orderId)
  );
  return res.data.payload;
};

export const createOrder = async (
  companyId: string,
  data: CreateOrderData
): Promise<Order> => {
  const res = await api.post<ApiResponse<Order>>(
    ENDPOINTS.ORDER.CREATE(companyId),
    data
  );
  return res.data.payload;
};

export const updateOrderValues = async (
  companyId: string,
  orderId: string,
  data: UpdateOrderValuesData
): Promise<void> => {
  await api.put<ApiResponse<void>>(
    ENDPOINTS.ORDER.UPDATE_VALUES(companyId, orderId),
    data
  );
};

export const updateOrderExtraValues = async (
  companyId: string,
  orderId: string,
  data: UpdateOrderExtraValuesData
): Promise<void> => {
  await api.put<ApiResponse<void>>(
    ENDPOINTS.ORDER.UPDATE_EXTRA_VALUES(companyId, orderId),
    data
  );
};

export const recalculateOrder = async (
  companyId: string,
  orderId: string
): Promise<void> => {
  await api.put<ApiResponse<null>>(
    ENDPOINTS.ORDER.RECALCULATE(companyId, orderId)
  );
};

export const updateFinalCalculation = async (
  companyId: string,
  orderId: string,
  data: UpdateFinalCalculationData
): Promise<void> => {
  await api.put<ApiResponse<null>>(
    ENDPOINTS.ORDER.UPDATE_FINAL_CALCULATION(companyId, orderId),
    data
  );
};

// =============================================================================
// UPLOAD SERVICES
// =============================================================================

export const uploadSingleFile = async (file: File): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  const res = await api.post<ApiResponse<UploadResponse>>(
    ENDPOINTS.UPLOAD.SINGLE,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }
  );
  return res.data.payload;
};

// =============================================================================
// CUSTOMER SERVICES
// =============================================================================

export const getCustomers = async (
  companyId: string,
  params?: CustomerListParams
): Promise<CustomerListResponse> => {
  const defaultParams: CustomerListParams = {
    page: 1,
    limit: 10,
    sortBy: 'createdAt',
    sortOrder: 'DESC',
    search: '',
    ...params
  };

  const res = await api.post<ApiResponse<CustomerListResponse>>(
    ENDPOINTS.CUSTOMER.LIST(companyId),
    defaultParams
  );

  return res.data.payload;
};

export const getCustomer = async (
  companyId: string,
  customerId: string
): Promise<Customer> => {
  const res = await api.get<ApiResponse<Customer>>(
    ENDPOINTS.CUSTOMER.GET(companyId, customerId)
  );
  return res.data.payload;
};

export const createCustomer = async (
  companyId: string,
  data: CreateCustomerData
): Promise<Customer> => {
  const res = await api.post<ApiResponse<Customer>>(
    ENDPOINTS.CUSTOMER.CREATE(companyId),
    data
  );
  return res.data.payload;
};

export const updateCustomer = async (
  companyId: string,
  customerId: string,
  data: UpdateCustomerData
): Promise<void> => {
  await api.put<ApiResponse<Record<string, never>>>(
    ENDPOINTS.CUSTOMER.UPDATE(companyId, customerId),
    data
  );
};

export const deleteCustomer = async (
  companyId: string,
  customerId: string
): Promise<void> => {
  await api.delete<ApiResponse<Record<string, never>>>(
    ENDPOINTS.CUSTOMER.DELETE(companyId, customerId)
  );
};

// =============================================================================
// MEMBER SERVICES
// =============================================================================

export const getMembers = async (
  companyId: string,
  params?: MemberListParams
): Promise<MemberListResponse> => {
  const defaultParams: MemberListParams = {
    page: 1,
    limit: 10,
    sortBy: 'createdAt',
    sortOrder: 'DESC',
    search: '',
    ...params
  };

  const res = await api.post<ApiResponse<MemberListResponse>>(
    ENDPOINTS.MEMBER.LIST(companyId),
    defaultParams
  );

  return res.data.payload;
};

export const inviteMember = async (
  companyId: string,
  data: InviteMemberData
): Promise<InviteMemberResponse> => {
  const res = await api.post<ApiResponse<InviteMemberResponse>>(
    ENDPOINTS.MEMBER.INVITE(companyId),
    data
  );
  return res.data.payload;
};

export const acceptInvite = async (
  data: AcceptInviteData
): Promise<AcceptInvitePayload> => {
  const res = await api.post<ApiResponse<AcceptInvitePayload>>(
    ENDPOINTS.MEMBER.ACCEPT_INVITE,
    data
  );
  return res.data.payload;
};

// =============================================================================
// Login History Services
// =============================================================================

export const getLoginHistory = async (
  params?: LoginHistoryParams
): Promise<LoginHistoryPayload> => {
  const res = await api.get<ApiResponse<LoginHistoryPayload>>(
    ENDPOINTS.LOGIN_HISTORY.LIST,
    { params: { page: params?.page || 1, limit: params?.limit || 10 } }
  );
  return res.data.payload;
};
