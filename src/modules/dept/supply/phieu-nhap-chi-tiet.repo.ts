import { db } from '@/server/db'
import { docNotesRepo } from '@/modules/core/doc-notes/doc-notes.repo'
import { loadNhapCho } from '@/modules/dept/warehouse/nhap-cho.repo'
import { docsRepo } from '@/modules/dept/warehouse/stock.repo'
import {
  lichSuPhieuNhap,
  phieuNhapKhacCuaDon,
  type MocLichSu,
} from '@/lib/phieu-nhap-lich-su'
import type { NhapCho } from '@/lib/phieu-nhap-cho'
import { loadDaVe, type DaVeRow } from './da-ve.repo'
import { supplyRepo } from './supply.repo'

export type ChiTietPhieuNhap = {
  /** Đúng dòng của màn Đã về — để hộp Sửa phiếu dùng lại nguyên vẹn. */
  row: DaVeRow
  created_at: string
  nguoi_lap: string | null
  nhap_cho: NhapCho | null
  /**
   * MỌI dòng sổ của phiếu — kể cả dòng mà dòng đơn đã bị gỡ (`po_line_id` về
   * null: PNK-2026-0066 có 15 dòng, 2 dòng bàn Elos gỡ khỏi đơn). `row.lines`
   * chỉ giữ dòng còn nối đơn nên không dùng để bày.
   */
  dong: {
    id: string
    code: string
    name: string
    unit: string
    qty_ordered: number | null
    qty: number
    qty_rejected: number
    khoa: boolean
    kg_can: number | null
    note: string | null
    con_noi_don: boolean
  }[]
  /** Phiếu đã bị đảo: đảo bởi phiếu nào, lúc nào, ai, vì sao. */
  dao: { code: string; at: string; actor: string | null; reason: string | null } | null
  lich_su: MocLichSu[]
  /** Phiếu nhập khác của cùng đơn — phiếu đã đảo trỏ sang phiếu đang hiệu lực. */
  khac: { doc_id: string; code: string; at: string; con_hieu_luc: boolean }[]
}

const one = <T>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
const ok = <T extends { error: { message: string } | null }>(r: T): T => {
  if (r.error) throw new Error(r.error.message)
  return r
}

/**
 * CHI TIẾT MỘT PHIẾU NHẬP THEO ĐƠN MUA (04/10/2026, bản vẽ J3/J4) — khu Mua hàng.
 *
 * Không dựng lại luật: kết quả nhận + quan hệ đảo/lập lại/điều chỉnh đọc từ
 * `loadDaVe` (một chỗ luật), chỉ nạp từ NGÀY CỦA PHIẾU trở đi — đủ thấy phiếu
 * lập lại nó và phiếu mới nhất của đơn, không phải kéo cả sổ.
 *
 * Trả `'khong-theo-don'` cho phiếu nhập ngoài đơn / hoàn kho (không thuộc Mua
 * hàng — trang gọi chuyển sang sổ phiếu Kho), `null` khi không có phiếu.
 */
export async function loadChiTietPhieuNhap(
  docId: string,
): Promise<ChiTietPhieuNhap | 'khong-theo-don' | null> {
  const { data: doc } = ok(
    await db()
      .from('warehouse_docs')
      .select(
        'id, code, kind, doc_date, created_at, actor:users!warehouse_docs_created_by_fkey(name)',
      )
      .eq('id', docId)
      .maybeSingle(),
  )
  if (!doc) return null
  const d = doc as {
    id: string
    code: string
    kind: string
    doc_date: string
    created_at: string
    actor: { name: string | null } | { name: string | null }[] | null
  }
  if (d.kind !== 'receipt') return 'khong-theo-don'

  const [{ rows }, { data: daoRows }, soLines] = await Promise.all([
    loadDaVe(d.doc_date.slice(0, 10)),
    db()
      .from('warehouse_docs')
      .select(
        'code, created_at, reason, actor:users!warehouse_docs_created_by_fkey(name)',
      )
      .eq('reversal_of_doc_id', docId)
      .limit(1)
      .then(ok),
    docsRepo.listLines(docId),
  ])
  const row = rows.find((r) => r.doc_id === docId)
  if (!row) return 'khong-theo-don'

  const [nhapCho, cungDon, ghiChu] = await Promise.all([
    loadNhapCho(
      docId,
      row.lines.map((l) => ({ po_line_id: l.po_line_id, production_order_id: null })),
    ),
    supplyRepo.docsByPo(row.po_id),
    docNotesRepo.list('po', row.po_id),
  ])
  const r0 = (
    (daoRows ?? []) as {
      code: string
      created_at: string
      reason: string | null
      actor: { name: string | null } | { name: string | null }[] | null
    }[]
  )[0]
  const dao = r0
    ? {
        code: r0.code,
        at: r0.created_at,
        actor: one(r0.actor)?.name ?? null,
        reason: r0.reason,
      }
    : null
  const nguoiLap = one(d.actor)?.name ?? null

  return {
    row,
    created_at: d.created_at,
    nguoi_lap: nguoiLap,
    nhap_cho: nhapCho,
    dong: soLines.map((l) => {
      const v = row.lines.find((x) => x.movement_id === l.id)
      return {
        id: l.id,
        code: l.material_code ?? '—',
        name: l.material_name ?? '',
        unit: l.material_unit ?? '',
        qty_ordered: l.qty_ordered,
        qty: l.qty,
        qty_rejected: l.qty_rejected,
        khoa: v?.stock_status === 'blocked',
        kg_can: v?.qty2_actual ?? null,
        note: l.note,
        con_noi_don: l.po_line_id != null,
      }
    }),
    dao,
    lich_su: lichSuPhieuNhap({
      code: d.code,
      ghiSo: { at: d.created_at, actor: nguoiLap, soDong: soLines.length },
      dao,
      cungDon,
      ghiChuDon: ghiChu.map((n) => ({
        id: n.id,
        at: n.created_at,
        actor: n.author_name,
        body: n.body,
        deleted: n.deleted_at != null,
      })),
    }),
    khac: phieuNhapKhacCuaDon(d.code, cungDon),
  }
}
