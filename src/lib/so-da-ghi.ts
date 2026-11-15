/**
 * SỔ ĐÃ GHI (bản vẽ 13/11/2026 https://claude.ai/artifact/4ub2By9o62SJN4wCcXGrFe,
 * duyệt Q1–Q7) — logic THUẦN dùng chung server + client: hình dữ liệu, bốn
 * loại "cần soát", luật sửa được không, kiểm ô gõ, tính lại kg.
 *
 * Luật sửa (Q3–Q5): dòng sổ sửa thẳng Đạt · Lỗi · Người làm · Lý do/Ghi chú tới
 * khi CHỐT SỔ NGÀY của tổ; không giữ số cũ — chốt sổ là mốc chính thức. Ghi nhầm
 * chi tiết / lệnh / công đoạn / ngày thì xoá dòng rồi ghi lại. Sau chốt sổ phải
 * mở khoá ở Sổ ngày (bắt lý do, 0295). Lệnh đã đóng thì sổ khoá hẳn.
 */

export type SdgDocStatus = 'nhap' | 'cho_xac_nhan' | 'da_xac_nhan' | 'tu_choi'

export type SdgDoc = {
  id: string
  doc_no: string
  lsx_id: string
  lsx_code: string
  /** Lệnh đã đóng / huỷ → sổ khoá hẳn. */
  lsx_closed: boolean
  stage: string
  stage_label: string
  team_id: string | null
  team_name: string | null
  entry_date: string
  status: SdgDocStatus
  shift: number | null
  worker_count: number | null
  hours_per_worker: number | null
  labor_hours: number | null
  created_by: string | null
  created_at: string
}

export type SdgLine = {
  id: string
  /** null = dòng lẻ trước phiếu (0172) — coi như chính thức. */
  doc_id: string | null
  lsx_id: string
  entry_date: string
  team_id: string | null
  stage: string
  component_id: string
  product_code: string | null
  /** Tên SP (name_vi) — thống kê ở xưởng nhớ SP theo tên hơn theo mã HG. */
  product_name: string | null
  name: string
  cluster: string | null
  qty_per_unit: number | null
  /** ĐM kg / cái — cột "ĐM kg" của file Excel đối chiếu. */
  dm_kg: number | null
  /** Thứ tự trong Bảng chi tiết — lưới xếp theo đây, không theo giờ ghi. */
  sort: number
  /** Phải làm của chi tiết (Hồ sơ lệnh: total_needed). null = không tra được. */
  needed: number | null
  /** Đã làm luỹ kế CHÍNH THỨC ở công đoạn này — cùng số ô Hồ sơ lệnh. */
  done: number | null
  /** Khả dụng ở công đoạn này (wipNumbers). null = đầu lộ trình. */
  available: number | null
  qty: number
  defect: number
  kg: number | null
  worker: string
  note: string
  defect_code: string | null
  defect_reason: string
  created_by: string | null
  created_at: string
}

export type SdgLock = { team_id: string; date: string; by: string | null; at: string }

export type SdgFlagKind = 'vuot_phai_lam' | 'trung' | 'loi_chua_ly_do' | 'vuot_kha_dung'
export type SdgFlag = { kind: SdgFlagKind; text: string }

export const isDraftStatus = (s: SdgDocStatus | null | undefined) =>
  s === 'nhap' || s === 'tu_choi'

const fmt = (n: number) => n.toLocaleString('vi-VN')
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/**
 * Bốn loại CẦN SOÁT (Q6) — chỉ tô và đếm, không chặn ghi.
 *  (a) luỹ kế vượt phải làm — dòng nháp tính cả số của chính nó (ghi chính thức
 *      sẽ vượt);
 *  (b) cùng chi tiết · công đoạn · tổ · ngày ở HAI phiếu trở lên — mọi dòng
 *      trong nhóm đều tô (sáng Lưu nháp, chiều ghi lại là chuyện thật);
 *  (c) có lỗi mà chưa có lý do (dòng cũ / dữ liệu nạp tay — Ghi đã bắt);
 *  (d) vượt khả dụng của công đoạn trước (Hàn, Nguội, Sơn…; Phôi không có).
 */
export function flagsOf(
  lines: SdgLine[],
  docs: Map<string, Pick<SdgDoc, 'doc_no' | 'status'>>,
): Map<string, SdgFlag[]> {
  const out = new Map<string, SdgFlag[]>()
  const push = (id: string, f: SdgFlag) => out.set(id, [...(out.get(id) ?? []), f])

  const groups = new Map<string, SdgLine[]>()
  for (const l of lines) {
    const k = `${l.component_id}|${l.stage}|${l.entry_date}|${l.team_id ?? ''}`
    groups.set(k, [...(groups.get(k) ?? []), l])
  }
  for (const g of groups.values()) {
    const docIds = new Set(g.map((l) => l.doc_id ?? `le:${l.id}`))
    if (docIds.size < 2) continue
    for (const l of g) {
      const khac = g
        .filter((x) => (x.doc_id ?? `le:${x.id}`) !== (l.doc_id ?? `le:${l.id}`))
        .map((x) => (x.doc_id ? (docs.get(x.doc_id)?.doc_no ?? 'phiếu khác') : 'dòng lẻ'))
      push(l.id, {
        kind: 'trung',
        text: `có ở ${docIds.size} phiếu ngày ${dm(l.entry_date)} (cùng ${[...new Set(khac)].join(', ')})`,
      })
    }
  }

  for (const l of lines) {
    const st = l.doc_id ? docs.get(l.doc_id)?.status : 'da_xac_nhan'
    if (l.needed != null && l.done != null && l.needed > 0) {
      const tong = isDraftStatus(st) ? l.done + l.qty : l.done
      if (tong > l.needed) {
        push(l.id, {
          kind: 'vuot_phai_lam',
          text: isDraftStatus(st)
            ? `ghi chính thức sẽ thành ${fmt(tong)} > phải làm ${fmt(l.needed)}`
            : `đã làm ${fmt(tong)} > phải làm ${fmt(l.needed)}`,
        })
      }
    }
    if (l.defect > 0 && !l.defect_code && !l.defect_reason.trim()) {
      push(l.id, { kind: 'loi_chua_ly_do', text: `lỗi ${fmt(l.defect)} chưa ghi lý do` })
    }
    if (l.available != null && l.available < 0) {
      push(l.id, {
        kind: 'vuot_kha_dung',
        text: `vượt khả dụng ${fmt(-l.available)} — ghi nhiều hơn đã nhận từ công đoạn trước`,
      })
    }
  }
  return out
}

/**
 * Sửa được không — trả LÝ DO khoá (câu bày tại chỗ), null = sửa được.
 * Người ghi, quản đốc (manager) và admin sửa được; như `deleteEntry`.
 */
export function khoaVi(
  l: Pick<SdgLine, 'team_id' | 'entry_date' | 'created_by'>,
  doc: Pick<SdgDoc, 'lsx_closed'> | null,
  ctx: {
    locked: (teamId: string, date: string) => boolean
    meId: string
    canAll: boolean
  },
): string | null {
  if (doc?.lsx_closed) return 'Lệnh đã đóng — sổ khoá hẳn'
  if (l.team_id && ctx.locked(l.team_id, l.entry_date))
    return 'Sổ ngày đã chốt — sửa phải mở khoá ở Sổ ngày'
  if (!ctx.canAll && l.created_by !== ctx.meId) return 'Chỉ người ghi dòng này sửa được'
  return null
}

/**
 * Đọc số gõ kiểu Việt: "1.080" = 1080 (dấu chấm ngăn nghìn), "2,5" = 2,5.
 * Trống → 0. Trả null khi gõ không ra số.
 */
export function parseSo(raw: string): number | null {
  const s = raw.replace(/\s/g, '')
  if (!s) return 0
  const t = /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)
    ? s.replace(/\./g, '').replace(',', '.')
    : s.replace(',', '.')
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export type SdgDraft = {
  qty?: string
  defect?: string
  worker?: string
  /** Lý do lỗi khi có lỗi, ngược lại là ghi chú. */
  text?: string
}

/** Câu chặn của MỘT dòng đang sửa — null = lưu được. Cùng luật entryLineSchema. */
export function draftProblem(
  l: Pick<SdgLine, 'qty' | 'defect' | 'defect_code' | 'defect_reason'>,
  d: SdgDraft,
): { field: 'qty' | 'defect' | 'text'; msg: string } | null {
  const qty = d.qty != null ? parseSo(d.qty) : l.qty
  const defect = d.defect != null ? parseSo(d.defect) : l.defect
  if (qty == null || qty < 0) return { field: 'qty', msg: 'Đạt phải là số không âm' }
  if (defect == null || defect < 0)
    return { field: 'defect', msg: 'Lỗi phải là số không âm' }
  if (qty <= 0 && defect <= 0)
    return { field: 'qty', msg: 'Dòng không còn số nào — bấm Xoá thay vì để 0' }
  if (defect > 0) {
    // Ô chữ đang là lý do lỗi: trống (sau sửa) và chưa có mã → chặn.
    const lyDo = d.text != null ? d.text.trim() : l.defect_reason.trim()
    const coMa = d.text == null && !!l.defect_code
    if (!lyDo && !coMa) return { field: 'text', msg: 'Có lỗi thì phải ghi lý do' }
  }
  return null
}

/**
 * Kg sau khi đổi SL: giữ đúng tỉ lệ kg/cái của dòng (kg ghi lúc nhập = ĐM × SL,
 * hoặc kg gõ tay) — đổi 84 → 74 thì kg đổi theo. Dòng chưa có kg thì tính từ ĐM.
 */
export function scaleKg(
  oldKg: number | null,
  oldQty: number,
  newQty: number,
  dmKg: number | null,
): number | null {
  const r2 = (n: number) => Math.round(n * 100) / 100
  if (oldKg != null && oldQty > 0) return r2((oldKg * newQty) / oldQty)
  if (dmKg != null && dmKg > 0 && newQty > 0) return r2(dmKg * newQty)
  return oldKg != null && newQty === 0 ? 0 : null
}

/** Ô chữ của dòng: lý do lỗi khi có lỗi, ngược lại ghi chú. */
export function chuCuaDong(
  l: Pick<SdgLine, 'defect' | 'defect_code' | 'defect_reason' | 'note'>,
  labelOf: (code: string) => string | undefined,
): { mode: 'ly_do' | 'ghi_chu'; value: string } {
  if (l.defect > 0) {
    const v =
      l.defect_reason || (l.defect_code ? (labelOf(l.defect_code) ?? l.defect_code) : '')
    return { mode: 'ly_do', value: v }
  }
  return { mode: 'ghi_chu', value: l.note }
}
