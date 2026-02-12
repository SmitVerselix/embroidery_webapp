// =============================================================================
// ROLE TYPES
// =============================================================================

export type Role = {
  id: string;
  name: string;
};

// =============================================================================
// COMPANY TYPES
// =============================================================================

export type Company = {
  id: string;
  name: string;
  code: string;
};

export type CompanyResponse = {
  id: string;
  isActive: boolean;
  name: string;
  code: string;
  createdBy: string;
  updatedAt: string;
  createdAt: string;
  updatedBy: string | null;
  deletedBy: string | null;
  deletedAt: string | null;
  settings: unknown | null;
};

export type UserCompany = {
  company: Company;
  role: Role;
};

export type CompanyListResponse = {
  count: number;
  rows: UserCompany[];
};

export type CompanyListParams = {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
  search?: string;
};

// =============================================================================
// USER TYPES
// =============================================================================

export type User = {
  id: string;
  isActive: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  deletedBy: string | null;
  deletedAt: string | null;
  name: string;
  email: string;
  mobile: string | null;
  socialProvider: string | null;
  socialProviderId: string | null;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  profileImage: string | null;
  currentDeviceId: string | null;
  lastActiveAt: string | null;
  createdAt: string;
  updatedAt: string;
  roleId: string;
  role?: Role;
  companies?: UserCompany[];
};

// =============================================================================
// AUTH TYPES
// =============================================================================

export type AuthPayload = {
  token: string;
  user: User;
};

export type ApiResponse<T> = {
  success: boolean;
  status: number;
  message: string;
  payload: T;
};

export type AuthResponse = ApiResponse<AuthPayload>;

// =============================================================================
// PAGINATION TYPES
// =============================================================================

export type PaginatedResponse<T> = {
  count: number;
  rows: T[];
};

export type ListParams = {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC" | "asc" | "desc";
};

// =============================================================================
// ERROR TYPES
// =============================================================================

export type ApiError = {
  success: false;
  status: number;
  message: string;
  errors?: Record<string, string[]>;
};

// =============================================================================
// NAV TYPES (for RBAC)
// =============================================================================

export type NavAccess = {
  requireOrg?: boolean;
  permission?: string;
  role?: string;
  plan?: string;
  feature?: string;
};

export type NavItem = {
  title: string;
  url: string;
  icon?: string;
  isActive?: boolean;
  shortcut?: string[];
  items?: NavItem[];
  access?: NavAccess;
};

// =============================================================================
// PRODUCT TYPES
// =============================================================================

export type Product = {
  id: string;
  isActive: boolean;
  createdBy: string;
  updatedBy: string | null;
  deletedBy: string | null;
  deletedAt: string | null;
  companyId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  templates?: unknown[];
};

export type ProductListResponse = {
  count: number;
  rows: Product[];
};

export type ProductListParams = {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
  search?: string;
};

export type CreateProductData = {
  name: string;
};

export type UpdateProductData = {
  name?: string;
};

// =============================================================================
// TEMPLATE TYPES
// =============================================================================

export type TemplateType = "COSTING" | "DETAIL";

export const TEMPLATE_TYPES: { label: string; value: TemplateType }[] = [
  { label: "Costing", value: "COSTING" },
  { label: "Detail", value: "DETAIL" },
];

export type Template = {
  id: string;
  isActive: boolean;
  createdBy: string;
  updatedBy: string | null;
  deletedBy: string | null;
  deletedAt: string | null;
  companyId: string;
  productId: string;
  name: string;
  type: TemplateType;
  description?: string;
  parentTemplateId: string | null;
  isRepeatable: boolean;
  orderNo: number;
  createdAt: string;
  updatedAt: string;
};

export type TemplateListResponse = {
  count: number;
  rows: Template[];
};

export type TemplateListParams = {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
  search?: string;
};

export type CreateTemplateData = {
  name: string;
  type: TemplateType;
  description?: string;
};

export type UpdateTemplateData = {
  name?: string;
  type?: TemplateType;
  description?: string;
};

// =============================================================================
// TEMPLATE COLUMN TYPES
// =============================================================================

export type ColumnDataType = "NUMBER" | "TEXT" | "FORMULA";

export const COLUMN_DATA_TYPES: { label: string; value: ColumnDataType }[] = [
  { label: "Number", value: "NUMBER" },
  { label: "Text", value: "TEXT" },
  { label: "Formula", value: "FORMULA" },
];

export type TemplateColumn = {
  id: string;
  isActive: boolean;
  key: string;
  dataType: ColumnDataType;
  blockIndex: number;
  label: string;
  isRequired: boolean;
  isFinalCalculation: boolean;
  formula: string | null;
  templateId: string;
  createdBy: string;
  updatedBy: string | null;
  deletedBy: string | null;
  deletedAt: string | null;
  orderNo: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateColumnData = {
  key: string;
  dataType: ColumnDataType;
  blockIndex: number;
  label: string;
  isRequired: boolean;
  formula?: string;
};

export type UpdateColumnData = {
  key?: string;
  dataType?: ColumnDataType;
  blockIndex?: number;
  label?: string;
  isRequired?: boolean;
  isFinalCalculation?: boolean;
  formula?: string;
};

export type ReorderColumnData = {
  ids: string[];
};

// =============================================================================
// TEMPLATE ROW TYPES
// =============================================================================

export type RowType = "NORMAL" | "TOTAL";

export const ROW_TYPES: { label: string; value: RowType }[] = [
  { label: "Normal", value: "NORMAL" },
  { label: "Total", value: "TOTAL" },
];

export type TemplateRow = {
  id: string;
  isActive: boolean;
  label: string;
  rowType: RowType;
  isCalculated: boolean;
  templateId: string;
  createdBy: string;
  updatedBy: string | null;
  deletedBy: string | null;
  deletedAt: string | null;
  orderNo: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateRowData = {
  label: string;
  rowType: RowType;
  isCalculated: boolean;
};

export type UpdateRowData = {
  label?: string;
  rowType?: RowType;
  isCalculated?: boolean;
};

export type ReorderRowData = {
  ids: string[];
};

// =============================================================================
// TEMPLATE EXTRA TYPES
// =============================================================================

export type ExtraSectionType = "HEADER" | "FOOTER" | "MEDIA";

export const EXTRA_SECTION_TYPES: {
  label: string;
  value: ExtraSectionType;
  description: string;
}[] = [
  {
    label: "Header",
    value: "HEADER",
    description: "Displayed at the top of the template",
  },
  {
    label: "Footer",
    value: "FOOTER",
    description: "Displayed at the bottom of the template",
  },
  {
    label: "Media",
    value: "MEDIA",
    description: "Image/file shown on the right side",
  },
];

export type ExtraValueType = "TEXT" | "NUMBER" | "DATE" | "IMAGE" | "FILE";

export const EXTRA_VALUE_TYPES: {
  label: string;
  value: ExtraValueType;
  description: string;
}[] = [
  { label: "Text", value: "TEXT", description: "Plain text value" },
  { label: "Number", value: "NUMBER", description: "Numeric value" },
  { label: "Date", value: "DATE", description: "Date value" },
  { label: "Image", value: "IMAGE", description: "Image upload" },
  { label: "File", value: "FILE", description: "File attachment" },
];

export type ExtraVisibilityScope = "ALWAYS" | "ONLY_CHILD" | "ONLY_ROOT";

export const EXTRA_VISIBILITY_SCOPES: {
  label: string;
  value: ExtraVisibilityScope;
  description: string;
}[] = [
  {
    label: "Always",
    value: "ALWAYS",
    description: "Visible in all contexts",
  },
  {
    label: "Only Child",
    value: "ONLY_CHILD",
    description: "Visible only in child templates",
  },
  {
    label: "Only Root",
    value: "ONLY_ROOT",
    description: "Visible only in root templates",
  },
];

export type TemplateExtra = {
  id: string;
  isActive?: boolean;
  key?: string;
  sectionType: ExtraSectionType;
  valueType: ExtraValueType;
  visibilityScope: ExtraVisibilityScope;
  label: string;
  isRequired: boolean;
  allowMultiple: boolean;
  templateId: string;
  createdBy?: string;
  updatedBy?: string | null;
  deletedBy?: string | null;
  deletedAt?: string | null;
  orderNo: number;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateExtraData = {
  key: string;
  sectionType: ExtraSectionType;
  valueType: ExtraValueType;
  visibilityScope: ExtraVisibilityScope;
  label: string;
  isRequired: boolean;
  allowMultiple: boolean;
};

export type UpdateExtraData = {
  key?: string;
  sectionType?: ExtraSectionType;
  valueType?: ExtraValueType;
  visibilityScope?: ExtraVisibilityScope;
  label?: string;
  isRequired?: boolean;
  allowMultiple?: boolean;
};

export type ReorderExtraData = {
  ids: string[];
};

// =============================================================================
// TEMPLATE REORDER
// =============================================================================

export type ReorderTemplateData = {
  ids: string[];
};

// =============================================================================
// TEMPLATE WITH DETAILS
// NOTE: API returns "extra" (singular), not "extras"
// =============================================================================

export type TemplateWithDetails = Template & {
  columns: TemplateColumn[];
  rows: TemplateRow[];
  extra?: TemplateExtra[];
};

// =============================================================================
// ORDER TYPES
// =============================================================================

export type OrderType = "SAMPLE" | "PRODUCTION" | "CUSTOM";

export const ORDER_TYPES: { label: string; value: OrderType }[] = [
  { label: "Sample", value: "SAMPLE" },
  { label: "Production", value: "PRODUCTION" },
  { label: "Custom", value: "CUSTOM" },
];

export type OrderStatus =
  | "DRAFT"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "COMPLETED"
  | "CANCELLED";

export const ORDER_STATUSES: {
  label: string;
  value: OrderStatus;
  color: string;
}[] = [
  { label: "Draft", value: "DRAFT", color: "secondary" },
  { label: "Pending", value: "PENDING", color: "default" },
  { label: "Approved", value: "APPROVED", color: "default" },
  { label: "Rejected", value: "REJECTED", color: "destructive" },
  { label: "Completed", value: "COMPLETED", color: "default" },
  { label: "Cancelled", value: "CANCELLED", color: "secondary" },
];

// =============================================================================
// ORDER VALUE TYPES (used in create)
// =============================================================================

export type OrderValue = {
  value: string;
  rowId: string;
  columnId: string;
};

export type OrderTemplatePayload = {
  templateId: string;
  values: OrderValue[];
};

export type OrderExtraValue = {
  extraId: string;
  value: string;
};

export type OrderTemplateExtraPayload = {
  templateId: string;
  extraValues: OrderExtraValue[];
};

// =============================================================================
// ORDER VALUE TYPES (returned from GET with IDs)
// =============================================================================

export type OrderValueWithId = {
  id: string; // orderValueId
  value: string | null;
  calculatedValue: string | null;
  rowId: string;
  columnId: string;
  orderTemplateId?: string;
  row?: TemplateRow;
  column?: TemplateColumn;
};

export type OrderExtraValueWithId = {
  id: string; // orderExtraValueId
  value: string;
  templateExtraFieldId: string;
  orderIndex: number;
  meta?: unknown;
  orderTemplateId?: string;
};

// =============================================================================
// ORDER TEMPLATE SUMMARY (returned from GET)
// =============================================================================

export type OrderTemplateSummary = {
  id: string;
  isActive: boolean;
  orderTemplateId: string;
  total: string;
  discount: string | null;
  discountAmount: string;
  discountType: string | null;
  finalPayableAmount: string;
  createdAt: string;
  updatedAt: string;
};

// =============================================================================
// ORDER TEMPLATE DATA (returned from GET order — matches actual API response)
//
// IMPORTANT: The API returns `id` as the orderTemplateId field.
// The `templateId` is the reference to the template definition.
// Same templateId may appear multiple times (repeatable templates).
// =============================================================================

export type OrderTemplateData = {
  id: string; // orderTemplateId
  templateId: string;
  orderId: string;
  template?: Template;
  values: OrderValueWithId[];
  extraValues?: OrderExtraValueWithId[];
  summary?: OrderTemplateSummary;
  children?: OrderTemplateData[];
};

// =============================================================================
// ORDER TYPES (Main)
// =============================================================================

export type Order = {
  id: string;
  isActive: boolean;
  orderNo: string;
  productId: string;
  orderType: OrderType;
  description: string | null;
  companyId: string;
  customerId: string | null;
  referenceNo: string | null;
  status: OrderStatus | null;
  createdBy: string;
  updatedBy: string | null;
  deletedBy: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  product?: Product;
};

export type OrderWithDetails = Order & {
  templates?: OrderTemplateData[];
};

export type OrderListResponse = {
  count: number;
  rows: Order[];
};

export type OrderListParams = {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
  search?: string;
};

// =============================================================================
// ORDER CREATE PAYLOAD
// =============================================================================

export type CreateOrderData = {
  orderNo: string;
  productId: string;
  orderType: OrderType;
  description?: string;
  templates: OrderTemplatePayload[];
};

// =============================================================================
// ORDER UPDATE VALUES PAYLOAD (for main template values)
// =============================================================================

export type UpdateOrderValueItem = {
  orderValueId?: string; // existing value ID (omit for new values)
  value: string;
  rowId: string;
  columnId: string;
};

export type UpdateOrderValuesTemplatePayload = {
  templateId: string;
  orderTemplateId: string;
  parentOrderTemplateId?: string | null;
  deleteOrderValueIds?: string[]; // IDs of values to delete
  values: UpdateOrderValueItem[];
};

export type UpdateOrderValuesData = {
  templates: UpdateOrderValuesTemplatePayload[];
};

// =============================================================================
// ORDER UPDATE EXTRA VALUES PAYLOAD (for header/footer/media extras)
// =============================================================================

export type UpdateOrderExtraValueItem = {
  orderExtraValueId?: string; // existing extra value ID (omit for new)
  value: string;
  templateExtraFieldId: string;
  orderIndex?: number;
  meta?: unknown;
};

export type UpdateOrderExtraValuesTemplatePayload = {
  templateId: string;
  orderTemplateId: string;
  parentOrderTemplateId?: string | null;
  deleteOrderExtraValueIds?: string[]; // IDs of extra values to delete
  values: UpdateOrderExtraValueItem[];
};

export type UpdateOrderExtraValuesData = {
  templates: UpdateOrderExtraValuesTemplatePayload[];
};

// =============================================================================
// UPLOAD TYPES
// =============================================================================

export type UploadResponse = {
  url: string;
  key: string;
  size: number;
  mimetype: string;
  originalname: string;
  createdAt: string;
};

// =============================================================================
// CUSTOMER TYPES
// =============================================================================

export type Customer = {
  id: string;
  isActive: boolean;
  createdBy: string;
  updatedBy: string | null;
  deletedBy: string | null;
  deletedAt: string | null;
  companyId: string;
  name: string;
  referenceCode: string;
  createdAt: string;
  updatedAt: string;
};

export type CustomerListResponse = {
  count: number;
  rows: Customer[];
};

export type CustomerListParams = {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
  search?: string;
};

export type CreateCustomerData = {
  name: string;
  referenceCode: string;
};

export type UpdateCustomerData = {
  name?: string;
  referenceCode?: string;
};