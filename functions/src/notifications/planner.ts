import { createHash } from "node:crypto";
import type {
  AuditEvent,
  Notification,
  NotificationAudience,
} from "../domain/models.js";
import type { EvvEvaluation, EvaluatedException } from "../rules/evv.js";
import { ManagementStore } from "../persistence/firestore.js";

function notificationId(
  exceptionId: string,
  audience: NotificationAudience[],
): string {
  return createHash("sha256")
    .update(exceptionId + "\0" + [...audience].sort().join(","))
    .digest("hex");
}

export function notificationsForEvaluation(
  evaluation: EvvEvaluation,
  createdAt = new Date().toISOString(),
): Notification[] {
  return evaluation.exceptions
    .filter((item) => item.audience.length > 0)
    .map((item: EvaluatedException) => ({
      id: notificationId(item.exception.id, item.audience),
      eventType: "visit_exception." + item.exception.type.toLowerCase(),
      audience: [...item.audience],
      createdAt,
      deliveryStatus: "planned",
    }));
}

export async function persistEvvEvaluation(
  evaluation: EvvEvaluation,
  store = new ManagementStore(),
): Promise<{
  exceptionCount: number;
  notificationCount: number;
  auditCount: number;
}> {
  const notifications = notificationsForEvaluation(evaluation);

  for (const item of evaluation.exceptions) {
    await store.upsert("visitExceptions", item.exception);
  }

  for (const notification of notifications) {
    await store.upsert("notifications", notification);
  }

  for (const audit of evaluation.auditEvents) {
    await store.upsert("auditEvents", audit);
  }

  return {
    exceptionCount: evaluation.exceptions.length,
    notificationCount: notifications.length,
    auditCount: evaluation.auditEvents.length,
  };
}

export function notificationAudit(
  notification: Notification,
  action: "notification_planned" | "notification_acknowledged",
  actorId?: string,
): AuditEvent {
  return {
    id: createHash("sha256")
      .update(notification.id + "\0" + action + "\0" + (actorId ?? "system"))
      .digest("hex"),
    occurredAt: new Date().toISOString(),
    ...(actorId ? { actorId } : {}),
    actorType: actorId ? "user" : "system",
    action,
    entityType: "notification",
    entityId: notification.id,
    metadata: {
      eventType: notification.eventType,
      audience: notification.audience,
    },
  };
}
