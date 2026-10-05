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
      // Trả hàng NCC (⑤, 0080) — PO received có thể quay lại partial chờ giao bù.
      name: 'warehouse.return.created'
      doc_id: string
      code: string
      po_code: string
      reason: string
      created_by: string
      notify_ids: string[]
    }
  | {
      name: 'warehouse.stock.low'
      material_id: string
      material_code: string
      material_name: string
      /**
       * DÙNG ĐƯỢC, không phải tổng (0198). Thông báo phải bày CHÍNH con số đã
       * quyết có cảnh báo hay không — nói "còn 50" trong khi quyết theo 3 thì
       * người đọc tưởng hệ thống lỗi.
       */
      qty_ok: number
      min_stock: number
      caused_by: string
      notify_ids: string[]
    }

  // ── Kho — phiếu đảo (0161/K1) ────────────────────────────────────────
  | {
      name: 'warehouse.doc.reversed'
      /** Mã phiếu GỐC bị đảo + mã phiếu đảo mới sinh. */
      original_code: string
      reversal_code: string
      reason: string
      reversed_by: string
      notify_ids: string[]
    }
  /**
   * SỬA THÔNG TIN PHIẾU NHẬP ĐÃ GHI SỔ (02/10/2026, phương án B): số phiếu giao
   * NCC, người giao, ghi chú — không đổi tồn. Vết (trước → sau, lý do) vào Trao
   * đổi của đơn mua (handler `warehouse.audit`).
   */
  | {
      name: 'warehouse.doc.info_edited'
      doc_id: string
      doc_code: string
      po_id: string
      actor_id: string
      actor_name: string | null
      reason: string
      changes: { label: string; before: string | null; after: string | null }[]
    }
  /**
   * ĐIỀU CHỈNH CHÊNH LỆCH phiếu nhập đã ghi sổ (C, 02/10/2026): hàng đã dùng nên
   * không đảo được — ghi PNK bổ sung / PXK điều chỉnh đúng phần lệch. Vết vào
   * Trao đổi của đơn mua (handler `warehouse.audit`).
   */
  | {
      name: 'warehouse.doc.adjusted'
      doc_id: string
      doc_code: string
      po_id: string
      adjust_codes: string[]
      actor_id: string
      actor_name: string | null
      reason: string
      changes: { label: string; before: number; after: number }[]
    }
  /**
   * GHI KG CÂN BỔ SUNG vào phiếu nhập ĐÃ GHI SỔ (01/10/2026, chủ dự án duyệt):
   * nhôm/thép trả tiền theo kg cân mà lúc nhận quên cân. Kg chỉ là số đo, không
   * đổi tồn — nên cho ghi sau, bắt lý do; vết đi vào Trao đổi của ĐƠN MUA để
   * người mua và Kế toán cùng thấy (handler `warehouse.audit`).
   */
  | {
      name: 'warehouse.kg.recorded'
      doc_id: string
      doc_code: string
      po_id: string
      actor_id: string
      actor_name: string | null
      reason: string
      lines: {
        code: string
        unit: string
        qty: number
        before: number | null
        after: number
      }[]
    }

  // ── Kho — vòng duyệt kiểm kê (0157) ──────────────────────────────────
  | {
      name: 'warehouse.stocktake.pending'
      code: string
      created_by: string
      notify_ids: string[]
    }
  | {
      name: 'warehouse.stocktake.decided'
      code: string
      decision: 'approved' | 'rejected'
      decided_by: string
      /** Người lập biên bản — người cần biết kết quả. */
      recipient_id: string
      reason?: string
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
      /**
       * NGƯỜI PHỤ TRÁCH đơn lúc ra quyết định (`assigned_to`, đơn cũ rơi về
       * `created_by`) — người phải biết kết quả. Trước đây bắn theo `created_by`
       * nên đơn đã bàn giao (0128) thì người đang cầm đơn không hề hay biết.
       */
      owner_id: string | null
      reason?: string
    }
  // Rút đơn CHỜ DUYỆT về nháp để sửa (0128 — 6.2b): báo người duyệt khỏi
  // duyệt nhầm bản cũ trong thông báo.
  | {
      name: 'po.withdrawn'
      po_id: string
      code: string
      withdrawn_by: string
      approver_ids: string[]
    }
  /**
   * MỞ LẠI ĐƠN ĐÃ DUYỆT để sửa (16/09/2026): dấu duyệt bị xoá, đơn về nháp.
   * Báo người duyệt — họ vừa ký lên một bản sắp không còn tồn tại.
   */
  | {
      name: 'po.reopened'
      po_id: string
      code: string
      /** Bước đơn đang đứng lúc bị mở lại — vào thông báo để GĐ biết đã đi xa tới đâu. */
      from_status: string
      reopened_by: string
      reason: string
      approver_ids: string[]
    }
  /**
   * ĐIỀU CHỈNH ĐƠN ĐÃ GỬI (0210, 25/09/2026): áp dụng ngay, không duyệt lại —
   * người đã ký duyệt nhận thông báo kèm phần phát sinh và lý do.
   */
  | {
      name: 'po.adjusted'
      po_id: string
      code: string
      seq: number
      adjusted_by: string
      reason: string
      currency: string
      /** Phát sinh tổng thanh toán của lần này (âm = giảm). */
      delta_total: number
      total_after: number
      notify_ids: string[]
    }
  /**
   * THU HỒI CHỮ KÝ (0218, 01/10/2026): Giám đốc gỡ chữ ký trên đơn ĐÃ DUYỆT,
   * CHƯA GỬI NCC — đơn quay về chờ duyệt. Báo người phụ trách (nút "Gửi NCC"
   * của họ vừa khoá) kèm lý do.
   */
  | {
      name: 'po.unapproved'
      po_id: string
      code: string
      unapproved_by: string
      /** Người đã ký trước đó — có thể khác người thu hồi (ba người chung hộp ký). */
      signed_by: string | null
      reason: string
      owner_id: string | null
    }
  /**
   * GỬI GẤP, KÝ BÙ SAU (0218): trưởng phòng Cung ứng gửi NCC trước khi có chữ
   * ký. Báo MỌI người có quyền duyệt — đơn vào mục "Chờ ký bù" của hộp ký.
   */
  | {
      name: 'po.urgent_sent'
      po_id: string
      code: string
      sent_by: string
      reason: string
      approver_ids: string[]
    }
  /**
   * CÂU HỎI CỦA GIÁM ĐỐC (0218) — "Hỏi lại" (chưa quyết) hoặc "Yêu cầu xem
   * lại" (đã ký / đã gửi). Không đổi trạng thái đơn; báo người phụ trách.
   */
  | {
      name: 'po.question'
      po_id: string
      code: string
      question_id: string
      asked_by: string
      kind: 'ask' | 'review'
      body: string
      owner_id: string | null
    }
  /** Người phụ trách trả lời câu hỏi (0218) — báo người đã hỏi. */
  | {
      name: 'po.answered'
      po_id: string
      code: string
      question_id: string
      answered_by: string
      asker_id: string
      body: string
    }
  // Bàn giao đơn giữa nhân viên cung ứng (0128): đổi người phụ trách.
  | {
      name: 'po.reassigned'
      po_id: string
      code: string
      from_user_id: string | null
      to_user_id: string
      reassigned_by: string
    }
  // (po.lines_saved đã GỠ 13/08/2026 — user chốt: mô tả về danh mục phải qua
  //  hộp XÁC NHẬN sau khi lưu đơn, không tự ghi ngầm. Xem posService.
  //  catalogSuggestions + /api/dept/warehouse/materials/enrich.)
  /**
   * Đơn GỬI NCC (approved → ordered): giá đã chốt thật — handler cập nhật
   * `last_purchase_price` (chỉ đơn VND, xem po-catalog-backfill).
   */
  | {
      name: 'po.ordered'
      po_id: string
      code: string
      currency: string
      /** Người bấm gửi NCC — vào sổ vết giá của danh mục (0177). */
      ordered_by: string
      lines: { material_id: string | null; unit_price: number | null }[]
    }
  /**
   * CHỐT PHẦN THIẾU (0154): Cung ứng tuyên bố "phần còn lại không về nữa" —
   * báo Kho ngừng chờ lô này + GĐ/QL nắm (đơn có thể nhảy 'received' dù thiếu).
   */
  | {
      name: 'po.closed_short'
      po_id: string
      code: string
      closed_by: string
      reason: string
      /** Tóm tắt phần chốt cho thông báo: "MDF: 2 tấm · Bản lề: 5 cái". */
      summary: string
      notify_ids: string[]
    }

  // ── Báo giá — duyệt GĐ TUỲ CHỌN (0149, exec v3: Sale tự quyết trình) ──
  | {
      name: 'quote.submitted'
      quote_id: string
      code: string
      customer_name: string
      submitted_by: string
      approver_ids: string[]
      // true = trình lại sau khi bị GĐ từ chối.
      resubmitted?: boolean
    }
  | {
      name: 'quote.decided'
      quote_id: string
      code: string
      decision: 'approved' | 'rejected'
      decided_by: string
      /** Người lập báo giá — người phải biết kết quả. */
      owner_id: string | null
      reason?: string
    }

  // ── Lệnh sản xuất (FR-SAL-06 — Sales phát, GĐ duyệt) ─────────────────
  | {
      name: 'lsx.submitted'
      production_order_id: string
      code: string
      /** Mã các đơn được gộp vào lệnh (0113 — một lệnh nhiều đơn cùng khách). */
      order_codes: string[]
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
  | {
      // Phát BẢN CHỈNH SỬA của lệnh đã duyệt (0114): dòng/SL/spec đổi. Xưởng
      // phải in lại phiếu — dòng đổi được tô vàng trên bản mới.
      name: 'lsx.revised'
      production_order_id: string
      code: string
      revision: number
      changed_lines: number
      note: string | null
      revised_by: string
      notify_ids: string[]
    }
  | {
      // Đổi phạm vi lệnh ĐANG CHẠY: gộp thêm / gỡ bớt đơn (0113). Kế hoạch phải
      // thêm-bớt việc, Cung ứng phải soát lại vật tư đã đặt.
      name: 'lsx.orders.changed'
      production_order_id: string
      code: string
      added: string[]
      removed: string[]
      changed_by: string
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
      // PO Cung ứng phải xử lý tay, dạng "PO-… (việc cần làm)": đã gửi NCC, đơn
      // GỘP nhiều lệnh (còn phục vụ lệnh khác), hoặc đơn nháp (lib/po-cancel-cascade).
      pos_manual: string[]
      cancelled_by: string
      notify_ids: string[]
    }

  // ── Sản xuất — bàn giao công đoạn (0084: job done per dòng SP) ────────
  | {
      name: 'production.stage.done'
      production_order_id: string
      code: string
      stage: string
      stage_label: string
      /** Công đoạn kế tiếp trên lộ trình dòng SP; [] = cuối chuỗi. */
      next_stages: string[]
      next_stage_labels: string[]
      done_by: string
      /** Thành viên tổ phụ trách công đoạn kế tiếp. */
      notify_next_ids: string[]
      /** GĐ/Ban quản lý (quản đốc) — trừ người thao tác. */
      coordinator_ids: string[]
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

  /**
   * VẾT THAY ĐỔI DANH MỤC VẬT TƯ (0177). Danh mục sửa được từ nhiều đường —
   * màn Kho, hộp xác nhận sau khi lưu đơn, event giá khi gửi NCC — nên vết đi
   * qua bus: nơi ghi CHỈ MỘT (handler material.audit), service khỏi phải nhớ.
   */
  | {
      name: 'material.changed'
      material_id: string
      material_code: string | null
      /** NULL = máy tự ghi (event giá chạy ngoài phiên người dùng). */
      actor_id: string | null
      /** `retire` = ngừng dùng / dùng lại / xoá mã (05/10/2026); lý do nằm ở source_ref. */
      source: 'manual' | 'po_enrich' | 'po_price' | 'import' | 'system' | 'retire'
      /** Mã chứng từ gây ra thay đổi — PO-2026-0024, tên file nạp… */
      source_ref: string | null
      changes: { field: string; before: string | null; after: string | null }[]
    }

export type EventName = DomainEvent['name']

/** Trích payload cho 1 event name cụ thể. */
export type EventOf<N extends EventName> = Extract<DomainEvent, { name: N }>
