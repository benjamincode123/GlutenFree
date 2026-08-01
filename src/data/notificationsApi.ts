import { config } from '../config';
import {
  AppError,
  appErrorFromHttp,
  readApiErrorMessage,
} from '../errors/appError';

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
  take = 50
): Promise<NotificationsInbox> {
  let response: Response;
  try {
    response = await fetch(notificationsUrl(`?take=${take}`), {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
  } catch {
    throw new AppError('network');
  }
  if (!response.ok) {
    await throwForNotificationsResponse(response);
  }
  const data = (await response.json()) as Partial<NotificationsInbox>;
  return {
    unreadCount: data.unreadCount ?? 0,
    unreadMessages: Array.isArray(data.unreadMessages) ? data.unreadMessages : [],
    notifications: Array.isArray(data.notifications) ? data.notifications : [],
  };
}

export async function markNotificationRead(
  token: string,
  id: number
): Promise<{ unreadCount: number; unreadMessages: number[] }> {
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
  const data = (await response.json()) as {
    unreadCount?: number;
    unreadMessages?: number[];
  };
  return {
    unreadCount: data.unreadCount ?? 0,
    unreadMessages: Array.isArray(data.unreadMessages) ? data.unreadMessages : [],
  };
}

export async function markAllNotificationsRead(
  token: string
): Promise<{ unreadCount: number; unreadMessages: number[] }> {
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
  const data = (await response.json()) as {
    unreadCount?: number;
    unreadMessages?: number[];
  };
  return {
    unreadCount: data.unreadCount ?? 0,
    unreadMessages: Array.isArray(data.unreadMessages) ? data.unreadMessages : [],
  };
}
