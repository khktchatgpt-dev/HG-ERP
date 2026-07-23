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
      lsx_code: string | null // null = PO ngoài LSX (0076)
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

  // ── Lệnh sản xuất (FR-SAL-06 — Sales phát, GĐ duyệt) ─────────────────
  | {
      name: 'lsx.submitted'
      production_order_id: string
      code: string
      order_code: string
      customer_name: string
      lines_bom_pending: number
      submitted_by: string
      approver_ids: string[]
      // true = gửi duyệt lại sau khi bị GĐ từ chối (plan-order-lsx-lifecycle P1).
      resubmitted?: boolean
    }
  | {
      name: 'lsx.decided'
      production_order_id: string
      code: string
      decision: 'approved' | 'rejected'
      decided_by: string
      issued_by: string | null
      reason?: string
      // approved → báo Cung ứng + Kỹ thuật; rejected → báo người phát.
      notify_ids: string[]
    }

  // ── Đơn hàng bán — đổi/huỷ sau khi phát LSX (plan-order-lsx-lifecycle) ─
  | {
      name: 'order.changed_after_lsx'
      order_id: string
      order_code: string
      lsx_code: string
      changed_fields: string[]
      lines_changed: boolean
      changed_by: string
      // Cung ứng + GĐ/QL — vật tư có thể đã đặt theo số cũ.
      notify_ids: string[]
    }
  | {
      name: 'order.cancelled'
      order_id: string
      order_code: string
      reason: string
      lsx_code: string | null
      lsx_cancelled: boolean
      pos_cancelled: string[] // mã PO chưa gửi NCC — đã tự huỷ theo
      pos_manual: string[] // mã PO đã gửi NCC — Cung ứng phải xử lý tay
      cancelled_by: string
      notify_ids: string[]
    }

  // ── Sản xuất — bàn giao công đoạn + sự cố xưởng (tách vai 07/2026) ────
  | {
      name: 'production.stage.done'
      production_order_id: string
      code: string
      stage: string
      stage_label: string
      /** Công đoạn kế tiếp trên lộ trình (union các dòng SP); [] = cuối chuỗi. */
      next_stages: string[]
      next_stage_labels: string[]
      done_by: string
      /** Thành viên các tổ phụ trách công đoạn kế tiếp. */
      notify_next_ids: string[]
      /** GĐ/Ban quản lý (quản đốc) — trừ người thao tác. */
      coordinator_ids: string[]
    }
  | {
      name: 'production.incident.reported'
      incident_id: string
      production_order_id: string | null
      lsx_code: string | null
      stage: string | null
      department_name: string | null
      message: string
      reported_by: string
      notify_ids: string[]
    }
  | {
      name: 'production.incident.resolved'
      incident_id: string
      lsx_code: string | null
      message: string
      resolved_by: string
      notify_ids: string[]
    }

  // ── RBAC — IT tự phục vụ ở /admin/permissions (Phase 3, audit 0075) ──────
  | {
      name: 'rbac.role.created'
      role_id: string
      role_key: string
      role_label: string
      actor_id: string
    }
  | {
      name: 'rbac.role.updated'
      role_id: string
      role_label: string
      before: Record<string, unknown>
      after: Record<string, unknown>
      actor_id: string
    }
  | {
      name: 'rbac.role.permissions_changed'
      role_id: string
      role_label: string
      added: string[]
      removed: string[]
      actor_id: string
    }
  | {
      name: 'rbac.role.assigned'
      user_id: string
      user_label: string
      role_id: string
      role_key: string
      role_label: string
      actor_id: string
    }
  | {
      name: 'rbac.role.revoked'
      user_id: string
      user_label: string
      role_id: string
      role_key: string
      role_label: string
      actor_id: string
    }

export type EventName = DomainEvent['name']

/** Trích payload cho 1 event name cụ thể. */
export type EventOf<N extends EventName> = Extract<DomainEvent, { name: N }>
