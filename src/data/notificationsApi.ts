import { config } from '../config';
import {
  AppError,
  appErrorFromHttp,
  readApiErrorMessage,
} from '../errors/appError';

export const NOTIFICATIONS_PAGE_SIZE = 5;

export interface UserNotificationItem {
  id: number;
  title: string;
  body: string;
  imageUrl: string | null;
  toUsers: string;
  createdAt: string;
  isUnread: boolean;
}

export interface NotificationsInbox {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  unreadCount: number;
  unreadMessages: number[];
  notifications: UserNotificationItem[];
}

function notificationsUrl(path: string): string {
  return `${config.apiBaseUrl.replace(/\/+$/, '')}/api/notifications${path}`;
}

async function throwForNotificationsResponse(response: Response): Promise<never> {
  const apiError = await readApiErrorMessage(response);
  throw appErrorFromHttp(response.status, apiError, 'unauthorized');
}

export async function fetchNotifications(
  token: string,
  page = 1,
  pageSize = NOTIFICATIONS_PAGE_SIZE
): Promise<NotificationsInbox> {
  const safePage = Math.max(1, page);
  const safeSize = Math.min(20, Math.max(1, pageSize));
  let response: Response;
  try {
    response = await fetch(
      notificationsUrl(`?page=${safePage}&pageSize=${safeSize}`),
      {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      }
    );
  } catch {
    throw new AppError('network');
  }
  if (!response.ok) {
    await throwForNotificationsResponse(response);
  }
  const data = (await response.json()) as Partial<NotificationsInbox>;
  const totalCount = data.totalCount ?? 0;
  const resolvedPageSize = data.pageSize ?? safeSize;
  const totalPages =
    data.totalPages ??
    Math.max(1, Math.ceil(totalCount / Math.max(1, resolvedPageSize)));
  return {
    page: data.page ?? safePage,
    pageSize: resolvedPageSize,
    totalCount,
    totalPages,
    unreadCount: data.unreadCount ?? 0,
    unreadMessages: Array.isArray(data.unreadMessages) ? data.unreadMessages : [],
    notifications: Array.isArray(data.notifications) ? data.notifications : [],
  };
}

export async function markNotificationRead(
  token: string,
  id: number
): Promise<{ unreadCount: number }> {
  let response: Response;
  try {
    response = await fetch(notificationsUrl(`/${id}/read`), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
  } catch {
    throw new AppError('network');
  }
  if (!response.ok) {
    await throwForNotificationsResponse(response);
  }
  const data = (await response.json()) as { unreadCount?: number };
  return { unreadCount: data.unreadCount ?? 0 };
}

export async function markAllNotificationsRead(
  token: string
): Promise<{ unreadCount: number }> {
  let response: Response;
  try {
    response = await fetch(notificationsUrl('/read-all'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
  } catch {
    throw new AppError('network');
  }
  if (!response.ok) {
    await throwForNotificationsResponse(response);
  }
  const data = (await response.json()) as { unreadCount?: number };
  return { unreadCount: data.unreadCount ?? 0 };
}
