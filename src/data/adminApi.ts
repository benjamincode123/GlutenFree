import { config } from '../config';
import {
  AppError,
  appErrorFromHttp,
  readApiErrorMessage,
} from '../errors/appError';

export interface ProductSubmissionItem {
  id: number;
  barcode: string;
  name: string;
  produsent: string | null;
  ingredients: string | null;
  glutenRating: string;
  imageUrl: string;
  submittedByUserId: number;
  submittedByUsername: string | null;
  status: string;
  createdAt: string;
}

export interface ProductSubmissionList {
  items: ProductSubmissionItem[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface ApproveSubmissionEdits {
  barcode: string;
  name: string;
  produsent: string;
  ingredients: string;
  glutenRating: string;
}

function adminUrl(path: string): string {
  return `${config.apiBaseUrl.replace(/\/+$/, '')}/api/admin${path}`;
}

async function throwForAdminResponse(response: Response): Promise<never> {
  const apiError = await readApiErrorMessage(response);
  throw appErrorFromHttp(response.status, apiError, 'forbidden');
}

export async function fetchPendingSubmissions(
  token: string,
  page: number
): Promise<ProductSubmissionList> {
  let response: Response;
  try {
    response = await fetch(adminUrl(`/product-submissions?page=${page}`), {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
  } catch {
    throw new AppError('network');
  }
  if (!response.ok) {
    await throwForAdminResponse(response);
  }
  return (await response.json()) as ProductSubmissionList;
}

export async function approveSubmission(
  token: string,
  id: number,
  edits: ApproveSubmissionEdits
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(adminUrl(`/product-submissions/${id}/approve`), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        barcode: edits.barcode,
        name: edits.name,
        produsent: edits.produsent,
        ingredients: edits.ingredients,
        glutenRating: edits.glutenRating,
      }),
    });
  } catch {
    throw new AppError('network');
  }
  if (!response.ok) {
    await throwForAdminResponse(response);
  }
}

export async function denySubmission(token: string, id: number): Promise<void> {
  let response: Response;
  try {
    response = await fetch(adminUrl(`/product-submissions/${id}/deny`), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
  } catch {
    throw new AppError('network');
  }
  if (!response.ok) {
    await throwForAdminResponse(response);
  }
}

export interface ProductImageValidationItem {
  id: number;
  catalog: string;
  productId: number;
  productName: string;
  imageUrl: string;
  submittedByUserId: number;
  submittedByUsername: string | null;
  status: string;
  createdAt: string;
}

export interface ProductImageValidationList {
  items: ProductImageValidationItem[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export async function fetchPendingImageValidations(
  token: string,
  page: number
): Promise<ProductImageValidationList> {
  let response: Response;
  try {
    response = await fetch(
      adminUrl(`/product-image-validations?page=${page}`),
      {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      }
    );
  } catch {
    throw new AppError('network');
  }
  if (!response.ok) {
    await throwForAdminResponse(response);
  }
  return (await response.json()) as ProductImageValidationList;
}

export async function approveImageValidation(
  token: string,
  id: number
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(adminUrl(`/product-image-validations/${id}/approve`), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
  } catch {
    throw new AppError('network');
  }
  if (!response.ok) {
    await throwForAdminResponse(response);
  }
}

export async function denyImageValidation(
  token: string,
  id: number
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(adminUrl(`/product-image-validations/${id}/deny`), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
  } catch {
    throw new AppError('network');
  }
  if (!response.ok) {
    await throwForAdminResponse(response);
  }
}

export interface WrongInfoReportItem {
  id: number;
  catalog: string;
  productId: number;
  emne: string;
  comment: string;
  reportedByUserId: number;
  reportedByUsername: string | null;
  status: string;
  createdAt: string;
  productFound: boolean;
  productBarcode: string | null;
  productName: string | null;
  productProdusent: string | null;
  productIngredients: string | null;
  productGlutenRating: string | null;
}

export interface WrongInfoReportList {
  items: WrongInfoReportItem[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export async function fetchPendingWrongInfoReports(
  token: string,
  page: number
): Promise<WrongInfoReportList> {
  let response: Response;
  try {
    response = await fetch(adminUrl(`/wrong-info-reports?page=${page}`), {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
  } catch {
    throw new AppError('network');
  }
  if (!response.ok) {
    await throwForAdminResponse(response);
  }
  return (await response.json()) as WrongInfoReportList;
}

export async function resolveWrongInfoReport(
  token: string,
  id: number
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(adminUrl(`/wrong-info-reports/${id}/resolve`), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
  } catch {
    throw new AppError('network');
  }
  if (!response.ok) {
    await throwForAdminResponse(response);
  }
}

export async function dismissWrongInfoReport(
  token: string,
  id: number
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(adminUrl(`/wrong-info-reports/${id}/dismiss`), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
  } catch {
    throw new AppError('network');
  }
  if (!response.ok) {
    await throwForAdminResponse(response);
  }
}
