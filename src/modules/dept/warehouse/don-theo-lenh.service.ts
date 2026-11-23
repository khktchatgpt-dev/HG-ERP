import { productionRepo } from '@/modules/dept/production/production.repo'
import { nplTheoLenhRepo } from '@/modules/dept/supply/npl-theo-lenh.repo'
import { tenNganNcc } from '@/lib/goi-y-ncc'
import {
  buildDonTheoLenh,
  tongTheoLenh,
  type KdDon,
  type KdDonLenh,
  type KdDongVao,
  type KdLenh,
  type KdLenhTong,
} from '@/lib/kho-don-theo-lenh'
import type { NplLenh } from '@/lib/npl-theo-lenh'
import { donTheoLenhRepo } from './don-theo-lenh.repo'

export type DonTheoLenhData = { lenh: KdLenhTong[]; rows: KdDonLenh[] }

/**
 * KHO · ĐƠN MUA THEO LỆNH — ghép đơn mua của mọi lệnh ĐANG CHẠY (Q3: đã duyệt /
 * đang sản xuất, `listActive` — cùng tập với màn Lệnh SX và màn NPL theo lệnh)
 * rồi giao cho lõi thuần `lib/kho-don-theo-lenh`. Đơn lấy vào: đơn có lệnh chính
 * đang chạy, đơn gộp có lệnh đi kèm đang chạy, đơn có dòng chia sang lệnh đang
 * chạy — và đơn HUỶ của các lệnh đó (lõi chỉ giữ đơn huỷ nào có phiếu nhập).
 * Chỉ đọc: Kho không sửa đơn mua.
 *
 * `chiLenh` = trang MỘT lệnh (`/warehouse/nhap/theo-lenh/[id]`, trang đơn mở từ
 * lệnh): chỉ dựng dòng của lệnh đó — cùng luật, cùng hàm, nên số khớp danh sách.
 * Lệnh đã xong (ngoài tập đang chạy) vẫn mở được qua link cũ.
 */
export async function loadDonTheoLenh(
  today: string,
  chiLenh?: string,
): Promise<DonTheoLenhData> {
  const [active, phans, diKem] = await Promise.all([
    productionRepo.listActive(),
    nplTheoLenhRepo.phanChia(),
    nplTheoLenhRepo.lenhDiKem(),
  ])
  let lenh: KdLenh[] = active.map((l) => ({
    id: l.id,
    code: l.code,
    ship_date: l.ship_date ?? null,
    khach: l.customer_name && l.customer_name !== '?' ? l.customer_name : null,
  }))
  if (chiLenh) {
    lenh = lenh.filter((l) => l.id === chiLenh)
    if (lenh.length === 0) {
      lenh = (await nplTheoLenhRepo.lenhTheoId([chiLenh])).map((l) => ({
        ...l,
        khach: null,
      }))
    }
    if (lenh.length === 0) return { lenh: [], rows: [] }
  }
  const activeIds = [...new Set(lenh.map((l) => l.id))]
  const laActive = new Set(activeIds)

  const lineIdsChia = [
    ...new Set(
      phans.filter((p) => laActive.has(p.production_order_id)).map((p) => p.line_id),
    ),
  ]
  const poIdsGop = [
    ...new Set(
      diKem.filter((x) => laActive.has(x.production_order_id)).map((x) => x.po_id),
    ),
  ]
  const [donChinh, poIdsChia, donHuy] = await Promise.all([
    nplTheoLenhRepo.donCuaLenh(activeIds),
    nplTheoLenhRepo.donCuaDong(lineIdsChia),
    donTheoLenhRepo.donHuy(activeIds, poIdsGop),
  ])
  const coRoi = new Set([...donChinh, ...donHuy].map((d) => d.id))
  const them = [...new Set([...poIdsGop, ...poIdsChia])].filter((id) => !coRoi.has(id))
  const donRaw = [...donChinh, ...donHuy, ...(await nplTheoLenhRepo.donTheoId(them))]
  const poIds = donRaw.map((d) => d.id)
  const nccIds = [
    ...new Set(donRaw.map((d) => d.supplier_id).filter((x): x is string => !!x)),
  ]

  const [dongRaw, daVe, tenNcc] = await Promise.all([
    nplTheoLenhRepo.dongCuaDon(poIds),
    nplTheoLenhRepo.daVe(poIds),
    nplTheoLenhRepo.tenNcc(nccIds),
  ])
  // Dòng phí / dịch vụ (0234) không phải hàng nhận vào kho.
  const dongHang = dongRaw.filter((d) => d.line_kind !== 'phi')
  const phieuByPo = await donTheoLenhRepo.phieuNhap(
    new Map(dongHang.map((d) => [d.id, d.po_id])),
  )

  // Lệnh ngoài tập đang chạy mà dòng chia / đơn gộp trỏ tới — cần mã + ngày xuất.
  const lenhById = new Map<string, NplLenh>(lenh.map((l) => [l.id, l]))
  const dongIds = new Set(dongHang.map((d) => d.id))
  const phanCuaDon = phans.filter((p) => dongIds.has(p.line_id))
  const poSet = new Set(poIds)
  const thieuLenh = [
    ...new Set([
      ...phanCuaDon.map((p) => p.production_order_id),
      ...diKem.filter((x) => poSet.has(x.po_id)).map((x) => x.production_order_id),
      ...donRaw.map((d) => d.production_order_id).filter((x): x is string => !!x),
    ]),
  ].filter((id) => !lenhById.has(id))
  for (const l of await nplTheoLenhRepo.lenhTheoId(thieuLenh)) lenhById.set(l.id, l)

  const diKemByPo = new Map<string, string[]>()
  for (const x of diKem) {
    diKemByPo.set(x.po_id, [...(diKemByPo.get(x.po_id) ?? []), x.production_order_id])
  }
  const dons: KdDon[] = donRaw.map((d) => ({
    id: d.id,
    code: d.code,
    status: d.status,
    expected_at: d.expected_at ? d.expected_at.slice(0, 10) : null,
    production_order_id: d.production_order_id,
    supplier: d.supplier_id ? tenNganNcc(tenNcc.get(d.supplier_id) ?? '') : '',
    extra_lsx_ids: (diKemByPo.get(d.id) ?? []).filter(
      (id) => id !== d.production_order_id,
    ),
  }))
  const dongs: KdDongVao[] = dongHang.map((d) => {
    const s = daVe.get(d.id)
    return {
      id: d.id,
      po_id: d.po_id,
      ma: d.mat_code ?? '—',
      ten: d.mat_name ?? d.line_name ?? '(dòng không tên)',
      dvt: d.line_unit || d.mat_unit || '',
      qty: d.qty,
      received: s?.received ?? 0,
      closed: s?.closed ?? false,
    }
  })

  const rows = buildDonTheoLenh({
    active: lenh,
    lenhById,
    dons,
    dongs,
    phans: phanCuaDon,
    phieuByPo,
    today,
  })
  return { lenh: tongTheoLenh(lenh, rows), rows }
}
