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
  ingredients: string | null;
  glutenRating: string;
  imageBase64: string;
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
