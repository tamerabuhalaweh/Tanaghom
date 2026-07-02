export const EVENT_PROBLEM_EVENTS = {
  PROBLEM_CREATED: 'event_problem.created',
  PROBLEM_UPDATED: 'event_problem.updated',
  PROBLEM_STATUS_CHANGED: 'event_problem.status_changed',
} as const;

export interface ProblemEvent {
  problemId: string;
  tenantKey: string;
  eventId: string;
  actorUserId: string;
  timestamp: Date;
}
