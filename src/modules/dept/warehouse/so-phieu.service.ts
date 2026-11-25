import type { User } from '@/modules/core/users/users.repo'
import { Forbidden } from '@/server/http'
import { suyMaTuLichSu } from '@/lib/kho-ma-ly-do'
import {
  demTheoThang,
  khoangKy,
  type Ky,
  type SoPhieuDong,
  type SoPhieuLoai,
} from '@/lib/kho-so-phieu'
import { canViewWarehouse } from './warehouse.service'
import { soPhieuRepo } from './so-phieu.repo'
import { nguoiCuaDon, type NguoiKho } from '@/lib/kho-phu-trach'
import { taiPhanCong } from './phu-trach.service'

export type SoPhieuKy = {
  rows: SoPhieuDong[]
  /** Số phiếu từng tháng của loại này trên toàn sổ — thanh trạng thái, câu rỗng. */
  theoThang: Record<string, number>
  /** Phiếu gần nhất của loại này (câu rỗng "phiếu gần nhất: …"). */
  ganNhat: { code: string; doc_date: string } | null
  /** Nhân viên Kho — lọc "Của tôi" (bước 3 phụ trách nhóm vật tư). */
  nguoiKho: NguoiKho[]
}

/**
 * SỔ PHIẾU THEO KỲ — một loại, một tháng (hoặc mọi tháng). Bản vẽ JG1wTjeF…
 * duyệt 23/11/2026. Rổ "Thiếu số NCC" dùng ĐÚNG tập `thieuSoNcc` của badge menu.
 */
export async function loadSoPhieuKy(
  user: User,
  kind: SoPhieuLoai,
  ky: Ky,
  today: string,
): Promise<SoPhieuKy> {
  if (!(await canViewWarehouse(user))) throw Forbidden()
  const k = khoangKy(ky)
  const [raw, ngays, thieu, phan] = await Promise.all([
    soPhieuRepo.theoKy({ kind, tu: k?.tu, den: k?.den }),
    soPhieuRepo.ngayTheoLoai(kind),
    kind === 'receipt' ? soPhieuRepo.thieuSoNcc(today) : Promise.resolve({ ids: [] }),
    taiPhanCong(),
  ])
  const ids = raw.map((r) => r.id)
  const [donLenh, lenhDong] = await Promise.all([
    soPhieuRepo.donLenhByDocIds(ids),
    soPhieuRepo.lenhTheoDongByDocIds(ids),
  ])
  const thieuSet = new Set(thieu.ids)
  const rows: SoPhieuDong[] = raw.map((r) => {
    const don = donLenh.get(r.id) ?? null
    const ma = [
      ...new Set(
        r.dong
          .map((m) => m.code ?? suyMaTuLichSu(m.ref_type, m.direction))
          .filter((x): x is NonNullable<typeof x> => !!x),
      ),
    ]
    return {
      id: r.id,
      code: r.code,
      kind: r.kind,
      doc_date: r.doc_date,
      status: r.status,
      counterparty: r.counterparty,
      team_name: r.team_name,
      dien_giai: r.note?.trim() || r.reason?.trim() || null,
      dao_cua: r.dao_cua,
      dao_boi: r.dao_boi,
      ma,
      so_dong: r.dong.length,
      don: don ? { po_id: don.po_id, po_code: don.po_code } : null,
      lenh: don && don.lsx.length > 0 ? don.lsx : (lenhDong.get(r.id) ?? []),
      supplier_doc_no: r.supplier_doc_no?.trim() || null,
      thieu_ncc: thieuSet.has(r.id),
      created_by: r.created_by,
      created_by_name: r.created_by_name,
      giu: nguoiCuaDon(r.nhom, phan.pc, phan.thuKho),
    }
  })
  return {
    rows,
    theoThang: demTheoThang(ngays.map((n) => n.doc_date)),
    ganNhat: ngays[0] ?? null,
    nguoiKho: phan.nguoi,
  }
}
