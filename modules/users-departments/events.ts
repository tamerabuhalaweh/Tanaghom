export const USER_EVENTS = {
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DEACTIVATED: 'user.deactivated',
} as const;

export const DEPARTMENT_EVENTS = {
  DEPARTMENT_CREATED: 'department.created',
  DEPARTMENT_UPDATED: 'department.updated',
} as const;

export interface UserCreatedEvent {
  userId: string;
  email: string;
  role: string;
  departmentId: string | null;
  timestamp: Date;
}

export interface UserUpdatedEvent {
  userId: string;
  changes: Record<string, unknown>;
  timestamp: Date;
}
