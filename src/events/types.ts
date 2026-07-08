/**
 * Domain events — 1 union type = 1 source of truth cho payload.
 * Thêm event: khai vào đây, TypeScript ép mọi handler + emitter khai đủ field.
 *
 * Convention:
 *   `<domain>.<action>` — dùng thì quá khứ (đã xảy ra rồi mới emit).
 */
export type DomainEvent =
  // ── Tasks ────────────────────────────────────────────────────────────
  | {
      name: 'task.created'
      task_id: string
      title: string
      assigner_id: string
      assignee_id: string
      kind: 'assigned' | 'self'
    }
  | {
      name: 'task.submitted'
      task_id: string
      title: string
      submitted_by: string
      assigner_id: string
    }
  | {
      name: 'task.approved'
      task_id: string
      title: string
      approved_by: string
      assignee_id: string
    }
  | {
      name: 'task.rejected'
      task_id: string
      title: string
      rejected_by: string
      assignee_id: string
      reason: string
    }
  | {
      name: 'task.reassigned'
      task_id: string
      title: string
      reassigned_by: string
      new_assignee_id: string
    }
  | {
      name: 'task.commented'
      task_id: string
      title: string
      comment_by: string
      comment_kind: 'comment' | 'progress_report'
      recipient_ids: string[]
    }
  | {
      name: 'task.status_changed'
      task_id: string
      title: string
      changed_by: string
      from_status: string
      to_status: string
      // Ai nhận notif (thường là assigner).
      notify_ids: string[]
    }

  // ── Kho (FR-WMS-02/08 — liên kết Kho ↔ Cung ứng 2 chiều) ─────────────
  | {
      name: 'warehouse.receipt.created'
      doc_id: string
      code: string
      po_code: string | null
      created_by: string
      notify_ids: string[]
    }
  | {
      name: 'warehouse.stock.low'
      material_id: string
      material_code: string
      material_name: string
      on_hand: number
      min_stock: number
      caused_by: string
      notify_ids: string[]
    }

  // ── Cung ứng — đơn đặt vật tư (BR-05, FR-ADM-03) ─────────────────────
  | {
      name: 'po.submitted'
      po_id: string
      code: string
      supplier_name: string
      lsx_code: string
      submitted_by: string
      approver_ids: string[]
    }
  | {
      name: 'po.decided'
      po_id: string
      code: string
      decision: 'approved' | 'rejected'
      decided_by: string
      created_by: string | null
      reason?: string
    }

export type EventName = DomainEvent['name']

/** Trích payload cho 1 event name cụ thể. */
export type EventOf<N extends EventName> = Extract<DomainEvent, { name: N }>
