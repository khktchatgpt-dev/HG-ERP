import { productionRepo } from '@/modules/dept/production/production.repo'
import { tenNganNcc } from '@/lib/goi-y-ncc'
import {
  buildNpl,
  type NplDon,
  type NplDong,
  type NplLenh,
  type NplRow,
} from '@/lib/npl-theo-lenh'
import {
  buildConPhaiDat,
  lenhKhongSo,
  tinhCan,
  type KindTheoDinhMuc,
  type NplCon,
  type NplKhongSo,
} from '@/lib/npl-con-phai-dat'
import { nplCanRaw } from './npl-can.repo'
import { nplTheoLenhRepo } from './npl-theo-lenh.repo'

/** Số của tab "Còn phải đặt" (bản vẽ 3) — số cần theo định mức ngũ kim + bao bì. */
export type NplCanData = {
  /** Mọi (lệnh, vật tư) có số cần — cả dòng đã đủ; tab lọc bằng `conPhaiDat`. */
  con: NplCon[]
  khongSo: NplKhongSo[]
  chuaMa: Record<KindTheoDinhMuc, number>
  chanQuyDoi: number
  /** SP góp số cần: bao nhiêu SP, bao nhiêu đã xác nhận định mức (Q3). */
  sp: { tong: number; xacNhan: number }
}

export type NplData = {
  rows: NplRow[]
  /** Mọi lệnh đang chạy (cả lệnh chưa có dòng) — để gom nhóm và lọc. */
  lenh: NplLenh[]
  /** Số đơn có ít nhất một dòng trên màn. */
  soDon: number
  can: NplCanData
}

/**
 * NPL THEO LỆNH — ghép dòng đơn mua của mọi lệnh ĐANG CHẠY (`listActive`: đã
 * duyệt / đang sản xuất — cùng tập với màn Lệnh sản xuất) rồi giao cho lõi thuần
 * `buildNpl`. Đơn lấy vào gồm: đơn có lệnh chính đang chạy, đơn gộp có lệnh đi kèm
 * đang chạy, và đơn có dòng chia sang lệnh đang chạy.
 */
export async function loadNplTheoLenh(today: string): Promise<NplData> {
  const [active, phans, diKem] = await Promise.all([
    productionRepo.listActive(),
    nplTheoLenhRepo.phanChia(),
    nplTheoLenhRepo.lenhDiKem(),
  ])
  const activeLenh: NplLenh[] = active.map((l) => ({
    id: l.id,
    code: l.code,
    ship_date: l.ship_date ?? null,
  }))
  const activeIds = new Set(activeLenh.map((l) => l.id))
  // Định mức không phụ thuộc đơn — đọc song song với chuỗi đơn bên dưới.
  const canRawP = nplCanRaw([...activeIds])

  const lineIdsChia = [
    ...new Set(
      phans.filter((p) => activeIds.has(p.production_order_id)).map((p) => p.line_id),
    ),
  ]
  const poIdsGop = diKem
    .filter((x) => activeIds.has(x.production_order_id))
    .map((x) => x.po_id)
  const [donChinh, poIdsChia] = await Promise.all([
    nplTheoLenhRepo.donCuaLenh([...activeIds]),
    nplTheoLenhRepo.donCuaDong(lineIdsChia),
  ])
  const coRoi = new Set(donChinh.map((d) => d.id))
  const them = [...new Set([...poIdsGop, ...poIdsChia])].filter((id) => !coRoi.has(id))
  const donRaw = [...donChinh, ...(await nplTheoLenhRepo.donTheoId(them))]
  const poIds = donRaw.map((d) => d.id)

  const nguoiIds = [
    ...new Set(
      donRaw.map((d) => d.assigned_to ?? d.created_by).filter((x): x is string => !!x),
    ),
  ]
  const nccIds = [
    ...new Set(donRaw.map((d) => d.supplier_id).filter((x): x is string => !!x)),
  ]
  const [dongRaw, daVe, tenNcc, tenNguoi] = await Promise.all([
    nplTheoLenhRepo.dongCuaDon(poIds),
    nplTheoLenhRepo.daVe(poIds),
    nplTheoLenhRepo.tenNcc(nccIds),
    nplTheoLenhRepo.tenNguoi(nguoiIds),
  ])

  // Lệnh ngoài tập đang chạy mà dòng chia / đơn gộp trỏ tới — cần mã + ngày xuất.
  const lenhById = new Map(activeLenh.map((l) => [l.id, l]))
  const dongIds = new Set(dongRaw.map((d) => d.id))
  const phanCuaDon = phans.filter((p) => dongIds.has(p.line_id))
  const thieuLenh = [
    ...new Set([
      ...phanCuaDon.map((p) => p.production_order_id),
      ...diKem.filter((x) => poIds.includes(x.po_id)).map((x) => x.production_order_id),
      ...donRaw.map((d) => d.production_order_id).filter((x): x is string => !!x),
    ]),
  ].filter((id) => !lenhById.has(id))
  for (const l of await nplTheoLenhRepo.lenhTheoId(thieuLenh)) lenhById.set(l.id, l)

  const diKemByPo = new Map<string, string[]>()
  for (const x of diKem) {
    const list = diKemByPo.get(x.po_id) ?? []
    list.push(x.production_order_id)
    diKemByPo.set(x.po_id, list)
  }

  const dons: NplDon[] = donRaw.map((d) => {
    const nguoi = d.assigned_to ?? d.created_by
    return {
      id: d.id,
      code: d.code,
      status: d.status,
      expected_at: d.expected_at,
      production_order_id: d.production_order_id,
      supplier: d.supplier_id ? tenNganNcc(tenNcc.get(d.supplier_id) ?? '') : '',
      assignee: nguoi ? (tenNguoi.get(nguoi) ?? null) : null,
      assignee_id: nguoi ?? null,
      extra_lsx_ids: (diKemByPo.get(d.id) ?? []).filter(
        (id) => id !== d.production_order_id,
      ),
    }
  })

  // Dòng phí / dịch vụ (0234, line_kind 'phi') không phải NPL.
  const dongs: NplDong[] = dongRaw
    .filter((d) => d.line_kind !== 'phi')
    .map((d) => {
      const s = daVe.get(d.id)
      return {
        id: d.id,
        po_id: d.po_id,
        material_id: d.material_id,
        ma: d.mat_code ?? '—',
        ten: d.mat_name ?? d.line_name ?? '(dòng không tên)',
        dvt: d.line_unit || d.mat_unit || '',
        nhom: d.nhom,
        qty: d.qty,
        received: s?.received ?? 0,
        closed: s?.closed ?? false,
      }
    })

  const rows = buildNpl({
    active: activeLenh,
    lenhById,
    dons,
    dongs,
    phans: phanCuaDon,
    today,
  })
  const raw = await canRawP
  const tinh = tinhCan(raw)
  const spCuaLenh = new Map<string, { sp: number; coDinhMuc: number }>()
  const daDem = new Set<string>()
  for (const d of raw.dongLenh) {
    const k = `${d.lsx_id}|${d.product_id}`
    if (daDem.has(k)) continue
    daDem.add(k)
    const s = spCuaLenh.get(d.lsx_id) ?? { sp: 0, coDinhMuc: 0 }
    s.sp += 1
    if (raw.spCoDinhMuc.has(d.product_id)) s.coDinhMuc += 1
    spCuaLenh.set(d.lsx_id, s)
  }
  const spGop = new Set(tinh.cans.flatMap((c) => c.sp.map((s) => s.sp_id)))
  const xacNhan = raw.sps.filter((s) => s.xac_nhan && spGop.has(s.id)).length

  return {
    rows,
    lenh: activeLenh,
    soDon: new Set(rows.map((r) => r.po_id)).size,
    can: {
      con: buildConPhaiDat(tinh.cans, rows, lenhById),
      khongSo: lenhKhongSo(activeLenh, tinh.cans, spCuaLenh),
      chuaMa: tinh.chuaMa,
      chanQuyDoi: tinh.chanQuyDoi,
      sp: { tong: spGop.size, xacNhan },
    },
  }
}
