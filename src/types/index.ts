export type Role = 'ADMIN' | 'USER';

export type MovementType = 'IN' | 'OUT' | 'ADJUSTMENT' | 'REVERSAL';

export type MovementSource = 'WEB' | 'TELEGRAM' | 'SYSTEM';

export type TelegramUpdateStatus = 'RECEIVED' | 'PROCESSING' | 'PROCESSED' | 'FAILED' | 'IGNORED';

export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'FULFILLED';

export type NotificationType = 'LOW_STOCK' | 'OUT_OF_STOCK' | 'SYSTEM';

export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: Role;
}
