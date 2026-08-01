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

export interface MergeSuggestionItem {
  id: number;
  catalog: string;
  sourceProductId: number;
  targetProductId: number;
  comment: string | null;
  suggestedByUserId: number;
  suggestedByUsername: string | null;
  status: string;
  createdAt: string;
  sourceFound: boolean;
  sourceBarcode: string | null;
  sourceName: string | null;
  sourceProdusent: string | null;
  targetFound: boolean;
  targetBarcode: string | null;
  targetName: string | null;
  targetProdusent: string | null;
}

export interface MergeSuggestionList {
  items: MergeSuggestionItem[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export async function fetchPendingMergeSuggestions(
  token: string,
  page: number
): Promise<MergeSuggestionList> {
  let response: Response;
  try {
    response = await fetch(adminUrl(`/merge-suggestions?page=${page}`), {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
  } catch {
    throw new AppError('network');
  }
  if (!response.ok) {
    await throwForAdminResponse(response);
  }
  return (await response.json()) as MergeSuggestionList;
}

/** Sum of pending product submissions, images, wrong-info, and merge suggestions. */
export async function fetchAdminPendingTotal(token: string): Promise<number> {
  const [subs, images, reports, merges] = await Promise.all([
    fetchPendingSubmissions(token, 1),
    fetchPendingImageValidations(token, 1),
    fetchPendingWrongInfoReports(token, 1),
    fetchPendingMergeSuggestions(token, 1),
  ]);
  const total =
    (subs.totalCount || 0) +
    (images.totalCount || 0) +
    (reports.totalCount || 0) +
    (merges.totalCount || 0);
  return Math.max(0, total);
}

export async function acceptMergeSuggestion(
  token: string,
  id: number
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(adminUrl(`/merge-suggestions/${id}/accept`), {
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

export async function dismissMergeSuggestion(
  token: string,
  id: number
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(adminUrl(`/merge-suggestions/${id}/dismiss`), {
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

export async function mergeProducts(
  token: string,
  body: { catalog: string; sourceProductId: number; targetProductId: number }
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(adminUrl(`/products/merge`), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AppError('network');
  }
  if (!response.ok) {
    await throwForAdminResponse(response);
  }
}

export type NotificationToUsers = 'all' | number | string | Array<number | string>;

export interface AdminNotificationItem {
  id: number;
  title: string;
  body: string;
  imageUrl: string | null;
  toUsers: string;
  createdAt: string;
  isUnread: boolean;
}

export interface CreateNotificationResult {
  ok: boolean;
  recipientCount: number;
  notification: AdminNotificationItem;
}

export interface CreateTopCollaboratorNotificationResult {
  ok: boolean;
  period: string;
  recipientUserIds: number[];
  recipientCount: number;
  notification: AdminNotificationItem;
}

export async function fetchAdminNotifications(
  token: string,
  take = 30
): Promise<AdminNotificationItem[]> {
  let response: Response;
  try {
    response = await fetch(adminUrl(`/notifications?take=${take}`), {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
  } catch {
    throw new AppError('network');
  }
  if (!response.ok) {
    await throwForAdminResponse(response);
  }
  const data = (await response.json()) as { notifications?: AdminNotificationItem[] };
  return data.notifications ?? [];
}

export async function createNotification(
  token: string,
  body: {
    title: string;
    body: string;
    imageUrl?: string | null;
    toUsers: NotificationToUsers;
  }
): Promise<CreateNotificationResult> {
  let response: Response;
  try {
    response = await fetch(adminUrl('/notifications'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: body.title,
        body: body.body,
        imageUrl: body.imageUrl || null,
        toUsers: body.toUsers,
      }),
    });
  } catch {
    throw new AppError('network');
  }
  if (!response.ok) {
    await throwForAdminResponse(response);
  }
  return (await response.json()) as CreateNotificationResult;
}

export async function createTopCollaboratorNotification(
  token: string,
  body: {
    period: 'day' | 'week' | 'month';
    title: string;
    body: string;
    imageUrl?: string | null;
    rank?: number;
    top?: number;
  }
): Promise<CreateTopCollaboratorNotificationResult> {
  let response: Response;
  try {
    response = await fetch(adminUrl('/notifications/top-collaborator'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        period: body.period,
        title: body.title,
        body: body.body,
        imageUrl: body.imageUrl || null,
        rank: body.rank,
        top: body.top,
      }),
    });
  } catch {
    throw new AppError('network');
  }
  if (!response.ok) {
    await throwForAdminResponse(response);
  }
  return (await response.json()) as CreateTopCollaboratorNotificationResult;
}

export async function deleteNotification(
  token: string,
  id: number
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(adminUrl(`/notifications/${id}`), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
  } catch {
    throw new AppError('network');
  }
  if (!response.ok) {
    await throwForAdminResponse(response);
  }
}
