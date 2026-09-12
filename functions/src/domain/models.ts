export type ExternalSystem = "hhaexchange" | "pthhs";

export interface ExternalReference {
  system: ExternalSystem;
  entityType: string;
  externalId: string;
  sourceUpdatedAt?: string;
  lastSyncedAt: string;
  sourceVersionHash?: string;
}

export interface Employee {
  id: string;
  externalReferences: ExternalReference[];
  displayName: string;
  status: "active" | "inactive" | "unknown";
  disciplines: string[];
}

export interface Patient {
  id: string;
  externalReferences: ExternalReference[];
  displayName: string;
  status: "active" | "inactive" | "unknown";
}

export interface Schedule {
  id: string;
  externalReferences: ExternalReference[];
  patientId: string;
  employeeId?: string;
  serviceCode?: string;
  discipline?: string;
  scheduledStart: string;
  scheduledEnd: string;
  authorizationId?: string;
  status: string;
}

export type ClockEventType = "clock_in" | "clock_out" | "unknown";

export interface ClockEvent {
  id: string;
  visitId: string;
  type: ClockEventType;
  occurredAt: string;
  source?: string;
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  externalReferences: ExternalReference[];
}

export interface VisitConfirmation {
  confirmed: boolean;
  confirmedAt?: string;
  method?: string;
  status?: string;
}

export interface Visit {
  id: string;
  externalReferences: ExternalReference[];
  patientId: string;
  employeeId?: string;
  scheduleId?: string;
  authorizationId?: string;
  serviceCode?: string;
  discipline?: string;
  actualStart?: string;
  actualEnd?: string;
  status: string;
  confirmation?: VisitConfirmation;
  clockEvents: ClockEvent[];
}

export interface Authorization {
  id: string;
  externalReferences: ExternalReference[];
  patientId: string;
  serviceCode?: string;
  effectiveDate?: string;
  expirationDate?: string;
  authorizedUnits?: number;
  unitType?: string;
  status: string;
}

export interface CaregiverAvailability {
  id: string;
  employeeId: string;
  externalReferences: ExternalReference[];
  kind: "permanent_week" | "special" | "other";
  startsAt?: string;
  endsAt?: string;
  dayOfWeek?: number;
  available: boolean;
}

export interface ServiceCode {
  id: string;
  externalReferences: ExternalReference[];
  code: string;
  description?: string;
  active: boolean;
}

export interface BillingRecord {
  id: string;
  visitId?: string;
  patientId?: string;
  externalReferences: ExternalReference[];
  status: string;
  amount?: number;
  currency?: string;
}

export interface CollectionRecord {
  id: string;
  externalReferences: ExternalReference[];
  status: string;
  claimStatus?: string;
  reasonForNonPayment?: string;
  amountOutstanding?: number;
}

export type NotificationAudience = "employee" | "manager" | "billing" | "admin";

export interface Notification {
  id: string;
  eventType: string;
  audience: NotificationAudience[];
  createdAt: string;
  acknowledgedAt?: string;
  deliveryStatus?: string;
}

export interface AuditEvent {
  id: string;
  occurredAt: string;
  actorId?: string;
  actorType: "user" | "system" | "integration";
  action: string;
  entityType?: string;
  entityId?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

export interface IntegrationSync {
  id: string;
  integration: "hhaexchange";
  resource: string;
  startedAt: string;
  completedAt?: string;
  checkpoint?: string;
  status: "running" | "success" | "failed";
  processedCount?: number;
  errorCode?: string;
}

export type VisitExceptionType =
  | "EVV_NO_CLOCK_IN"
  | "EVV_NO_CLOCK_OUT"
  | "EVV_LATE_CLOCK_IN"
  | "EVV_EARLY_CLOCK_OUT"
  | "EVV_SHORT_VISIT"
  | "EVV_LONG_VISIT"
  | "VISIT_UNCONFIRMED"
  | "VISIT_EDIT_REQUIRED"
  | "AUTHORIZATION_MISSING"
  | "AUTHORIZATION_AT_RISK"
  | "DOCUMENTATION_MISSING"
  | "POC_TASK_MISSING"
  | "INTEGRATION_ERROR";

export interface VisitException {
  id: string;
  visitId?: string;
  scheduleId?: string;
  type: VisitExceptionType;
  ruleVersion: string;
  severity: "info" | "warning" | "critical";
  createdAt: string;
  resolvedAt?: string;
  employeeVisible: boolean;
  managerVisible: boolean;
  reason: string;
}
