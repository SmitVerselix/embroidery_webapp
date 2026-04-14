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
  UpdateFinalCalculationData,
  OrderHistoryParams,
  OrderHistoryListResponse,
  CreateBlockData,
  TemplateBlock,
  UpdateBlockData,
  ReorderBlockData,
  KanbanBoard,
  KanbanBoardListResponse,
  KanbanBoardListParams,
  CreateKanbanBoardData,
  UpdateKanbanBoardData,
  KanbanSection,
  KanbanPermissionListResponse,
  KanbanPermissionListParams,
  CreateKanbanPermissionUserData,
  KanbanPermission,
  UpdateKanbanPermissionUserData,
  CompanyRoleListParams,
  CompanyRoleListResponse,
  CreateCompanyRoleData,
  CompanyRole,
  UpdateCompanyRoleData,
  OrderFormMaster,
  OrderFormMasterListResponse,
  OrderFormMasterListParams,
  CreateOrderFormMasterData,
  UpdateOrderFormMasterData,
  CreateJobcardOrderData,
  UpdateJobcardOrderData,
  CreateKanbanPermissionRoleData,
  KanbanRolePermission,
  UpdateKanbanPermissionRoleData,
  KanbanRolePermissionListResponse,
  KanbanRolePermissionListParams,
  CompanyRolePermissionListParams,
  CompanyRolePermissionListResponse,
  CreateCompanyRolePermissionData,
  CompanyRolePermission,
  PermissionListParams,
  Permission
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
// TEMPLATE BLOCK SERVICES
// =============================================================================

export const createBlock = async (
  companyId: string,
  productId: string,
  templateId: string,
  data: CreateBlockData
): Promise<TemplateBlock> => {
  const res = await api.post<ApiResponse<TemplateBlock>>(
    ENDPOINTS.BLOCK.CREATE(companyId, productId, templateId),
    data
  );
  return res.data.payload;
};

export const updateBlock = async (
  companyId: string,
  productId: string,
  templateId: string,
  blockId: string,
  data: UpdateBlockData
): Promise<void> => {
  await api.put<ApiResponse<number[]>>(
    ENDPOINTS.BLOCK.UPDATE(companyId, productId, templateId, blockId),
    data
  );
};

export const deleteBlock = async (
  companyId: string,
  productId: string,
  templateId: string,
  blockId: string
): Promise<void> => {
  await api.delete<ApiResponse<number[]>>(
    ENDPOINTS.BLOCK.DELETE(companyId, productId, templateId, blockId)
  );
};

export const reorderBlocks = async (
  companyId: string,
  productId: string,
  templateId: string,
  data: ReorderBlockData
): Promise<void> => {
  await api.put<ApiResponse<void>>(
    ENDPOINTS.BLOCK.REORDER(companyId, productId, templateId),
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
// ORDER FORM MASTER SERVICES
// =============================================================================

export const getOrderFormMasters = async (
  companyId: string,
  productId: string,
  params?: OrderFormMasterListParams
): Promise<OrderFormMasterListResponse> => {
  const defaultParams: OrderFormMasterListParams = {
    page: 1,
    limit: 10,
    sortBy: 'createdAt',
    sortOrder: 'DESC',
    search: '',
    ...params
  };

  const res = await api.post<ApiResponse<OrderFormMasterListResponse>>(
    ENDPOINTS.ORDER_FORM_MASTER.LIST(companyId, productId),
    defaultParams
  );

  return res.data.payload;
};

export const getOrderFormMaster = async (
  companyId: string,
  productId: string,
  id: string
): Promise<OrderFormMaster> => {
  const res = await api.get<ApiResponse<OrderFormMaster>>(
    ENDPOINTS.ORDER_FORM_MASTER.GET(companyId, productId, id)
  );
  return res.data.payload;
};

export const createOrderFormMaster = async (
  companyId: string,
  productId: string,
  data: CreateOrderFormMasterData
): Promise<OrderFormMaster> => {
  const res = await api.post<ApiResponse<OrderFormMaster>>(
    ENDPOINTS.ORDER_FORM_MASTER.CREATE(companyId, productId),
    data
  );
  return res.data.payload;
};

export const updateOrderFormMaster = async (
  companyId: string,
  productId: string,
  id: string,
  data: UpdateOrderFormMasterData
): Promise<void> => {
  await api.put<ApiResponse<number[]>>(
    ENDPOINTS.ORDER_FORM_MASTER.UPDATE(companyId, productId, id),
    data
  );
};

export const deleteOrderFormMaster = async (
  companyId: string,
  productId: string,
  id: string
): Promise<void> => {
  await api.delete<ApiResponse<number[]>>(
    ENDPOINTS.ORDER_FORM_MASTER.DELETE(companyId, productId, id)
  );
};

export const reorderOrderFormMasters = async (
  companyId: string,
  productId: string,
  data: { ids: string[] }
): Promise<void> => {
  await api.put<ApiResponse<void>>(
    ENDPOINTS.ORDER_FORM_MASTER.REORDER(companyId, productId),
    data
  );
};

// ==============================================================================
// ORDER FORM JOBCARD SERVICES
// ==============================================================================

export const createJobcardOrder = async (
  companyId: string,
  data: CreateJobcardOrderData
): Promise<Order> => {
  const res = await api.post<ApiResponse<Order>>(
    ENDPOINTS.ORDER_FORM_JOBCARD.CREATE_JOBCARD_ORDER(companyId),
    data
  );
  return res.data.payload;
};

export const updateJobcardOrder = async (
  companyId: string,
  orderId: string,
  data: UpdateJobcardOrderData
): Promise<void> => {
  await api.post<ApiResponse<void>>(
    ENDPOINTS.ORDER_FORM_JOBCARD.UPDATE_JOBCARD_ORDER(companyId, orderId),
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
    orderType: 'SAMPLE',
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
// ORDER HISTORY SERVICES
// =============================================================================

export const getOrderHistory = async (
  companyId: string,
  orderId: string,
  params?: OrderHistoryParams
): Promise<OrderHistoryListResponse> => {
  const defaultParams: OrderHistoryParams = {
    page: 1,
    limit: 10,
    sortBy: 'createdAt',
    sortOrder: 'DESC',
    search: '',
    ...params
  };

  // Remove empty action so backend doesn't filter by empty string
  const payload: Record<string, unknown> = { ...defaultParams };
  if (!payload.action) {
    delete payload.action;
  }

  const res = await api.post<ApiResponse<OrderHistoryListResponse>>(
    ENDPOINTS.ORDER.HISTORY(companyId, orderId),
    payload
  );

  return res.data.payload;
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
// KANBAN BOARD SERVICES
// =============================================================================

export const getKanbanBoards = async (
  companyId: string,
  params?: KanbanBoardListParams
): Promise<KanbanBoardListResponse> => {
  const defaultParams: KanbanBoardListParams = {
    page: 1,
    limit: 10,
    sortBy: 'createdAt',
    sortOrder: 'DESC',
    search: '',
    ...params
  };

  const res = await api.post<ApiResponse<KanbanBoardListResponse>>(
    ENDPOINTS.KANBAN.LIST(companyId),
    defaultParams
  );

  return res.data.payload;
};

export const getKanbanBoard = async (
  companyId: string,
  kanbanId: string
): Promise<KanbanBoard> => {
  const res = await api.get<ApiResponse<KanbanBoard>>(
    ENDPOINTS.KANBAN.GET(companyId, kanbanId)
  );
  return res.data.payload;
};

export const createKanbanBoard = async (
  companyId: string,
  data: CreateKanbanBoardData
): Promise<KanbanBoard> => {
  const res = await api.post<ApiResponse<KanbanBoard>>(
    ENDPOINTS.KANBAN.CREATE(companyId),
    data
  );
  return res.data.payload;
};

export const updateKanbanBoard = async (
  companyId: string,
  kanbanId: string,
  data: UpdateKanbanBoardData
): Promise<void> => {
  await api.put<ApiResponse<number[]>>(
    ENDPOINTS.KANBAN.UPDATE(companyId, kanbanId),
    data
  );
};

export const deleteKanbanBoard = async (
  companyId: string,
  kanbanId: string
): Promise<void> => {
  await api.delete<ApiResponse<number[]>>(
    ENDPOINTS.KANBAN.DELETE(companyId, kanbanId)
  );
};

// =============================================================================
// KANBAN SECTION SERVICES
// =============================================================================

export const getKanbanSections = async (
  companyId: string,
  kanbanId: string
): Promise<KanbanSection[]> => {
  const res = await api.get<ApiResponse<KanbanSection[]>>(
    ENDPOINTS.KANBAN.SECTION_LIST(companyId, kanbanId)
  );
  return res.data.payload;
};

// =============================================================================
// KANBAN PERMISSION SERVICES
// =============================================================================

export const getKanbanPermissionUsers = async (
  companyId: string,
  kanbanId: string,
  params?: KanbanPermissionListParams
): Promise<KanbanPermissionListResponse> => {
  const payload: Record<string, unknown> = {
    page: 1,
    limit: 10,
    sortBy: 'createdAt',
    sortOrder: 'DESC',
    search: '',
    ...params
  };

  // Remove empty sectionId so backend doesn't filter by empty string
  if (!payload.sectionId) {
    delete payload.sectionId;
  }

  const res = await api.post<ApiResponse<KanbanPermissionListResponse>>(
    ENDPOINTS.KANBAN.PERMISSION_USER_LIST(companyId, kanbanId),
    payload
  );

  return res.data.payload;
};

// =============================================================================
// KANBAN PERMISSION USER SERVICES
// =============================================================================

export const createKanbanPermissionUser = async (
  companyId: string,
  kanbanId: string,
  data: CreateKanbanPermissionUserData
): Promise<KanbanPermission> => {
  const res = await api.post<ApiResponse<KanbanPermission>>(
    ENDPOINTS.KANBAN.PERMISSION_USER_CREATE(companyId, kanbanId),
    data
  );
  return res.data.payload;
};

export const updateKanbanPermissionUser = async (
  companyId: string,
  kanbanId: string,
  userListId: string,
  data: UpdateKanbanPermissionUserData
): Promise<void> => {
  await api.put<ApiResponse<number[]>>(
    ENDPOINTS.KANBAN.PERMISSION_USER_UPDATE(companyId, kanbanId, userListId),
    data
  );
};

export const deleteKanbanPermissionUser = async (
  companyId: string,
  kanbanId: string,
  userListId: string
): Promise<void> => {
  await api.delete<ApiResponse<number[]>>(
    ENDPOINTS.KANBAN.PERMISSION_USER_DELETE(companyId, kanbanId, userListId)
  );
};

// =============================================================================
// KANBAN PERMISSION ROLE SERVICES
// =============================================================================

export const getKanbanPermissionRoles = async (
  companyId: string,
  kanbanId: string,
  params?: KanbanRolePermissionListParams
): Promise<KanbanRolePermissionListResponse> => {
  const payload: Record<string, unknown> = {
    page: 1,
    limit: 10,
    sortBy: 'createdAt',
    sortOrder: 'DESC',
    search: '',
    ...params
  };

  // Remove empty sectionId so backend doesn't filter by empty string
  if (!payload.sectionId) {
    delete payload.sectionId;
  }

  const res = await api.post<ApiResponse<KanbanRolePermissionListResponse>>(
    ENDPOINTS.KANBAN.PERMISSION_ROLE_LIST(companyId, kanbanId),
    payload
  );

  return res.data.payload;
};

export const createKanbanPermissionRole = async (
  companyId: string,
  kanbanId: string,
  data: CreateKanbanPermissionRoleData
): Promise<KanbanRolePermission> => {
  const res = await api.post<ApiResponse<KanbanRolePermission>>(
    ENDPOINTS.KANBAN.PERMISSION_ROLE_CREATE(companyId, kanbanId),
    data
  );
  return res.data.payload;
};

export const updateKanbanPermissionRole = async (
  companyId: string,
  kanbanId: string,
  roleListId: string,
  data: UpdateKanbanPermissionRoleData
): Promise<void> => {
  await api.put<ApiResponse<number[]>>(
    ENDPOINTS.KANBAN.PERMISSION_ROLE_UPDATE(companyId, kanbanId, roleListId),
    data
  );
};

export const deleteKanbanPermissionRole = async (
  companyId: string,
  kanbanId: string,
  roleListId: string
): Promise<void> => {
  await api.delete<ApiResponse<number[]>>(
    ENDPOINTS.KANBAN.PERMISSION_ROLE_DELETE(companyId, kanbanId, roleListId)
  );
};

// =============================================================================
// COMPANY ROLE SERVICES
// =============================================================================

export const getCompanyRoles = async (
  companyId: string,
  params?: CompanyRoleListParams
): Promise<CompanyRoleListResponse> => {
  const defaultParams: CompanyRoleListParams = {
    page: 1,
    limit: 10,
    sortBy: 'createdAt',
    sortOrder: 'DESC',
    search: '',
    ...params
  };

  const res = await api.post<ApiResponse<CompanyRoleListResponse>>(
    ENDPOINTS.COMPANY_ROLE.LIST(companyId),
    defaultParams
  );

  return res.data.payload;
};

export const createCompanyRole = async (
  companyId: string,
  data: CreateCompanyRoleData
): Promise<CompanyRole> => {
  const res = await api.post<ApiResponse<CompanyRole>>(
    ENDPOINTS.COMPANY_ROLE.CREATE(companyId),
    data
  );
  return res.data.payload;
};

export const updateCompanyRole = async (
  companyId: string,
  roleId: string,
  data: UpdateCompanyRoleData
): Promise<void> => {
  await api.put<ApiResponse<number[]>>(
    ENDPOINTS.COMPANY_ROLE.UPDATE(companyId, roleId),
    data
  );
};

export const deleteCompanyRole = async (
  companyId: string,
  roleId: string
): Promise<void> => {
  await api.delete<ApiResponse<number[]>>(
    ENDPOINTS.COMPANY_ROLE.DELETE(companyId, roleId)
  );
};

// =============================================================================
// PERMISSION SERVICES
// =============================================================================

export const getAllPermissions = async (
  params?: PermissionListParams
): Promise<Permission[]> => {
  const defaultParams: PermissionListParams = {
    sortBy: 'createdAt',
    sortOrder: 'DESC',
    search: '',
    ...params
  };

  const res = await api.post<ApiResponse<Permission[]>>(
    ENDPOINTS.PERMISSION.ALL,
    defaultParams
  );

  return res.data.payload;
};

// =============================================================================
// COMPANY ROLE PERMISSION SERVICES
// =============================================================================

export const getCompanyRolePermissions = async (
  companyId: string,
  params?: CompanyRolePermissionListParams
): Promise<CompanyRolePermissionListResponse> => {
  const defaultParams: CompanyRolePermissionListParams = {
    page: 1,
    limit: 10,
    sortBy: 'createdAt',
    sortOrder: 'DESC',
    search: '',
    ...params
  };

  const res = await api.post<ApiResponse<CompanyRolePermissionListResponse>>(
    ENDPOINTS.COMPANY_ROLE_PERMISSION.LIST(companyId),
    defaultParams
  );

  return res.data.payload;
};

export const createCompanyRolePermission = async (
  companyId: string,
  data: CreateCompanyRolePermissionData
): Promise<CompanyRolePermission> => {
  const res = await api.post<ApiResponse<CompanyRolePermission>>(
    ENDPOINTS.COMPANY_ROLE_PERMISSION.CREATE(companyId),
    data
  );
  return res.data.payload;
};

export const deleteCompanyRolePermission = async (
  companyId: string,
  id: string
): Promise<void> => {
  await api.delete<ApiResponse<Record<string, never>>>(
    ENDPOINTS.COMPANY_ROLE_PERMISSION.DELETE(companyId, id)
  );
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
