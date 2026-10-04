/**
 * LỊCH SỬ MỘT PHIẾU NHẬP (04/10/2026, bản vẽ J3/J4 canvas "Cung ứng · Hàng về"
 * › Bản 7) — gom từ ba nguồn đã có, không bảng vết mới:
 *
 *  · chính phiếu: lúc ghi sổ + người lập;
 *  · phiếu kho cùng đơn (`supplyRepo.docsByPo`): phiếu ĐẢO nó, phiếu LẬP LẠI
 *    nó ("Sửa lại PNK-…"), phiếu ĐIỀU CHỈNH chênh lệch của nó;
 *  · Trao đổi nội bộ của đơn (`doc_notes`): vết "Sửa thông tin PNK-…",
 *    "Điều chỉnh PNK-…", "Ghi kg cân bổ sung cho PNK-…" do warehouse.audit ghi.
 *
 * Một việc có thể có ở HAI nguồn (điều chỉnh: phiếu đ/c + ghi chú vết). Ghi chú
 * nói được lý do và người làm nên thắng; phiếu đ/c chỉ thành mốc khi không ghi
 * chú nào nhắc tới mã của nó.
 */

export type MocLichSu = {
  key: string
  /** ISO — lúc việc được GHI vào máy. */
  at: string
  label: string
  actor: string | null
  detail: string | null
  tone?: 'act' | 'done' | 'warn' | 'stop'
}

/** Đầu câu của các vết `warehouse.audit` ghi vào Trao đổi của đơn. */
const VET = ['Sửa thông tin ', 'Điều chỉnh ', 'Ghi kg cân bổ sung ']

type PhieuCungDon = {
  doc_id: string
  code: string
  kind: 'receipt' | 'return' | 'reversal' | 'adjustment'
  entered_at: string
  reversal_of: string | null
  fix_of: string | null
  adjust_of: string | null
}

export function lichSuPhieuNhap(p: {
  code: string
  ghiSo: { at: string; actor: string | null; soDong: number }
  /** Phiếu đảo phiếu này (đọc kèm lý do + người đảo). */
  dao: { code: string; at: string; actor: string | null; reason: string | null } | null
  cungDon: PhieuCungDon[]
  ghiChuDon: {
    id: string
    at: string
    actor: string | null
    body: string
    deleted: boolean
  }[]
}): MocLichSu[] {
  const out: MocLichSu[] = [
    {
      key: 'ghi-so',
      at: p.ghiSo.at,
      label: `Ghi sổ ${p.code}`,
      actor: p.ghiSo.actor,
      detail: `${p.ghiSo.soDong} dòng`,
      tone: 'done',
    },
  ]
  // Mã đứng một mình: "PNK-2026-0066" không được khớp "PNK-2026-00661".
  const coMa = (body: string, code: string) =>
    new RegExp(`${code.replace(/[-]/g, '\\-')}(?![0-9])`).test(body)

  const ghiChu = p.ghiChuDon.filter((n) => !n.deleted && coMa(n.body, p.code))
  for (const n of ghiChu) {
    // Vết do warehouse.audit ghi: "<việc> PNK-… — <chi tiết>". Câu người gõ
    // tay có nhắc mã phiếu thì giữ nguyên văn, gọi là ghi chú.
    const vet = VET.some((v) => n.body.startsWith(v)) && n.body.includes(' — ')
    const tone = n.body.startsWith('Điều chỉnh') ? 'warn' : 'act'
    out.push(
      vet
        ? { key: `gc-${n.id}`, at: n.at, label: n.body.split(' — ')[0], actor: n.actor, detail: n.body.split(' — ').slice(1).join(' — '), tone } // prettier-ignore
        : { key: `gc-${n.id}`, at: n.at, label: 'Ghi chú trên đơn', actor: n.actor, detail: n.body, tone: 'act' }, // prettier-ignore
    )
  }
  if (p.dao)
    out.push({
      key: 'dao',
      at: p.dao.at,
      label: `Đảo bằng ${p.dao.code}`,
      actor: p.dao.actor,
      detail: p.dao.reason,
      tone: 'stop',
    })
  for (const d of p.cungDon) {
    if (d.kind === 'receipt' && d.fix_of === p.code)
      out.push({ key: `lap-lai-${d.doc_id}`, at: d.entered_at, label: `Lập lại bằng ${d.code}`, actor: null, detail: null, tone: 'done' }) // prettier-ignore
    if (d.kind === 'adjustment' && d.adjust_of === p.code && !ghiChu.some((n) => coMa(n.body, d.code)))
      out.push({ key: `dc-${d.doc_id}`, at: d.entered_at, label: `Điều chỉnh chênh lệch bằng ${d.code}`, actor: null, detail: null, tone: 'warn' }) // prettier-ignore
  }
  return out.sort((a, b) => a.at.localeCompare(b.at))
}

/**
 * Phiếu nhập KHÁC của cùng đơn (J4) — để phiếu đã đảo trỏ được sang phiếu đang
 * hiệu lực khi DB không nối được (đảo bằng script, không mang dấu "Sửa lại").
 */
export function phieuNhapKhacCuaDon(
  code: string,
  cungDon: (PhieuCungDon & { reversed_by: string | null; at: string })[],
): { doc_id: string; code: string; at: string; con_hieu_luc: boolean }[] {
  return cungDon
    .filter((d) => d.kind === 'receipt' && d.code !== code)
    .map((d) => ({
      doc_id: d.doc_id,
      code: d.code,
      at: d.at,
      con_hieu_luc: d.reversed_by == null,
    }))
}
