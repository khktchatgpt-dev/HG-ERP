import { Forbidden, NotFound } from '@/server/http'
import type { User } from '@/modules/core/users/users.repo'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { poLineAmount } from '@/lib/po-line'
import { docQuyCach } from '@/lib/quy-cach-vat-tu'
import {
  goiYNcc,
  type DongLichSu,
  type NccTheoNhom,
  type UngVienNcc,
} from '@/lib/goi-y-ncc'
import {
  deriveLine,
  poTemplateMeta,
  type PoTemplate,
  type PoLineDraft,
} from '@/lib/po-template'
import { thueMacDinh } from '@/lib/po-thue'
import { giaTheoCoSo } from '@/lib/ke-hoach-len-don'
import { tinhDongMua } from '@/lib/lsx-bang-ke-mua'
import { sameUnit } from '@/lib/po-paste'
import { chonMacDinh } from '@/lib/goi-y-ncc'
import type { LsxBangKe } from './lsx-bang-ke.service'
import type { LuaChonExcel } from './lsx-bang-ke-excel'
import { isSupplyStaff } from './suppliers.service'
import { keHoachMuaRepo, type ChonNccRow } from './ke-hoach-mua.repo'
import { posRepo } from './pos.repo'
import { posService } from './pos.service'
import { poCreateSchema } from './pos.schema'
import type {
  ChonNccDeleteInput,
  ChonNccUpsertInput,
  TaoDonInput,
} from './ke-hoach-mua.schema'

/** Một mã cần chọn NCC — chỉ thứ gợi ý cần biết. */
export type MaCanChon = {
  material_id: string
  material_name: string
  /** ĐVT mua của mã (danh mục). */
  unit: string
  sub_group: string | null
  group_name: string | null
  spec: string | null
}

export type NguonNccLenh = {
  /** Ứng viên đã xếp theo thứ tự gợi ý — phần tử đầu là gợi ý của máy. */
  goiY: Record<string, UngVienNcc[]>
  /** Khối lượng một ĐVT mua của mã (đổi đ/kg ↔ đ/cây). */
  kgMoiDv: Record<string, number | null>
  /** Lựa chọn đã lưu của lệnh (0275). */
  chon: (ChonNccRow & { supplier_name: string })[]
  /** Mọi NCC còn đặt hàng được — cho ô "NCC khác…" và gán hàng loạt. */
  nccs: { id: string; code: string | null; name: string }[]
  /** Mẫu đơn gần nhất của từng NCC — gợi ý mẫu ở bước 3. */
  mauNcc: Record<string, PoTemplate>
  /** Thuế mặc định của từng NCC (đơn gần nhất → hồ sơ NCC) — cùng luật form soạn đơn. */
  thueNcc: Record<string, { rate: number; incl: boolean }>
}

export type KetQuaTaoDon = {
  tao: { id: string; code: string; supplier_name: string; so_dong: number; thieu_gia: number }[] // prettier-ignore
  loi: { supplier_name: string; loi: string }[]
}

/** Các mã CÒN PHẢI ĐẶT của bảng kê — cùng hàm tính với màn (`tinhDongMua`). */
export function maCanChonCua(bk: LsxBangKe): MaCanChon[] {
  return bk.rows
    .filter((r) => tinhDongMua(r).conPhaiDat > 0)
    .map((r) => ({
      material_id: r.material_id,
      material_name: r.material_name,
      unit: r.unit,
      sub_group: r.sub_group ?? null,
      group_name: r.group_name,
      spec: r.spec ?? null,
    }))
}

async function assertCanEdit(user: User): Promise<void> {
  if (user.role === 'admin') return
  if (await isSupplyStaff(user)) return
  throw Forbidden('Chỉ phòng Cung ứng mới chọn NCC cho kế hoạch mua')
}

async function assertLsx(id: string): Promise<void> {
  if (!(await productionRepo.findById(id))) throw NotFound('Không tìm thấy lệnh sản xuất')
}

/**
 * KẾ HOẠCH MUA · BƯỚC 2 (22/10/2026) — gợi ý NCC + lựa chọn đã lưu.
 * Lịch sử đọc MỘT lần cho cả lệnh (≈700 dòng cả phòng), gợi ý tính bằng
 * `lib/goi-y-ncc` (thuần, có test).
 */
export const keHoachMuaService = {
  async nguonNcc(lsxId: string, mas: MaCanChon[]): Promise<NguonNccLenh> {
    const ids = mas.map((m) => m.material_id)
    const [dong, nccAll, kg, chon, mauNcc, thue] = await Promise.all([
      keHoachMuaRepo.dongDonGiaChot(),
      keHoachMuaRepo.tenNcc(),
      keHoachMuaRepo.kgMoiDv(ids),
      keHoachMuaRepo.chonCuaLenh(lsxId),
      posRepo.lastTemplateBySupplier(),
      posRepo.taxBySupplier(),
    ])
    const ten = new Map(nccAll.map((s) => [s.id, s.name]))

    const lichSu: DongLichSu[] = dong
      .filter((l) => l.qty_ordered > 0)
      .map((l) => {
        const kimLoai = l.template === 'aluminium' || l.template === 'metal_kg'
        return {
          material_id: l.material_id,
          supplier_id: l.supplier_id,
          supplier_name: ten.get(l.supplier_id) ?? '—',
          po_code: l.po_code,
          at: l.at,
          qty: l.qty_ordered,
          amount: poLineAmount({
            ...l,
            price_basis: l.price_basis === 'unit2' ? 'unit2' : 'unit',
          }),
          kg: l.unit2 === 'kg' && l.qty2 ? l.qty2 : null,
          dv: l.dv,
          quyCach: kimLoai
            ? (docQuyCach(l.mat_name, [l.spec, l.finish].filter(Boolean).join(' '), l.group_name)?.key ?? null) // prettier-ignore
            : null,
        }
      })
      .filter((l) => l.amount > 0)

    // NCC theo tiểu nhóm (rơi về nhóm khi mã chưa chia tiểu nhóm) — đếm dòng.
    const theoNhom = new Map<string, Map<string, number>>()
    for (const l of dong) {
      const k = l.sub_group ?? l.group_name
      if (!k) continue
      const m = theoNhom.get(k) ?? new Map<string, number>()
      m.set(l.supplier_id, (m.get(l.supplier_id) ?? 0) + 1)
      theoNhom.set(k, m)
    }
    const nhomCua = (k: string | null): NccTheoNhom[] =>
      [...(theoNhom.get(k ?? '') ?? new Map<string, number>()).entries()].map(
        ([supplier_id, soLan]) => ({
          supplier_id,
          supplier_name: ten.get(supplier_id) ?? '—',
          soLan,
        }),
      )

    const goiY: Record<string, UngVienNcc[]> = {}
    for (const m of mas) {
      goiY[m.material_id] = goiYNcc(
        {
          material_id: m.material_id,
          quyCach: docQuyCach(m.material_name, m.spec, m.group_name)?.key ?? null,
          kgMoiDv: kg.get(m.material_id) ?? null,
          unit: m.unit,
        },
        lichSu,
        nhomCua(m.sub_group ?? m.group_name),
      )
    }
    return {
      goiY,
      kgMoiDv: Object.fromEntries(ids.map((id) => [id, kg.get(id) ?? null])),
      chon: chon.map((c) => ({ ...c, supplier_name: ten.get(c.supplier_id) ?? '—' })),
      nccs: nccAll
        .filter((s) => s.can_order)
        .map(({ id, code, name }) => ({ id, code, name })),
      mauNcc,
      thueNcc: Object.fromEntries(
        nccAll.flatMap((s) => {
          const t = thueMacDinh({ ncc: thue.ncc[s.id], nccVat: s.vat_rate })
          return t ? [[s.id, { rate: t.rate, incl: t.incl }]] : []
        }),
      ),
    }
  },

  /**
   * BƯỚC 3 — mỗi NCC một đơn NHÁP gắn lệnh, người phụ trách = người bấm, KHÔNG
   * gửi duyệt (Q5). Đi qua `posService.create` như form soạn đơn: cùng quyền,
   * cùng chặn NCC khoá / lệnh chưa duyệt, cùng `deriveLine` + điều khoản mặc
   * định của mẫu. Phần riêng ở đây:
   *  · thông số kg của mã (kg/m + dài cây cho nhôm, kg/cây cho thép) điền như
   *    form soạn đơn điền khi chọn mã — thiếu thì để trống, KHÔNG giả định 6 m;
   *  · giá chọn ở bước 2 ĐỔI về đúng cơ sở dòng đơn (`giaTheoCoSo`) — đổi không
   *    được thì để trống chứ không mang đ/kg vào ô đ/cây;
   *  · thuế theo NCC (`thueMacDinh`), không có thì theo mẫu.
   * Một NCC lỗi (NCC bị khoá…) không chặn các NCC khác — trả về từng lỗi.
   */
  async taoDon(user: User, input: TaoDonInput): Promise<KetQuaTaoDon> {
    await assertCanEdit(user)
    await assertLsx(input.production_order_id)
    const ids = [
      ...new Set(input.groups.flatMap((g) => g.lines.map((l) => l.material_id))),
    ]
    const [ts, thue, nccAll] = await Promise.all([
      keHoachMuaRepo.thongSoKg(ids),
      posRepo.taxBySupplier(),
      keHoachMuaRepo.tenNcc(),
    ])
    const ncc = new Map(nccAll.map((s) => [s.id, s]))
    const out: KetQuaTaoDon = { tao: [], loi: [] }

    for (const g of input.groups) {
      const tenNcc = ncc.get(g.supplier_id)?.name ?? '—'
      try {
        const template = g.template as PoTemplate
        let thieuGia = 0
        const lines = g.lines.map((l) => {
          const t = ts.get(l.material_id)
          const dong: Record<string, unknown> = {
            material_id: l.material_id,
            qty_ordered: l.qty,
          }
          if (template === 'aluminium' && t?.kg_per_m && t.bar_length_m) {
            dong.weight_per_m = t.kg_per_m
            dong.bar_length_m = t.bar_length_m
          }
          if (template === 'metal_kg' && t?.kg) dong.weight_per_unit = t.kg
          const dich = deriveLine(template, dong as unknown as PoLineDraft).price_basis
          const gia = giaTheoCoSo(l.price, l.co_so, dich === 'unit2' ? 'unit2' : 'unit', t?.kg ?? null) // prettier-ignore
          if (gia == null) thieuGia++
          return { ...dong, unit_price: gia }
        })
        const md = thueMacDinh({ ncc: thue.ncc[g.supplier_id], nccVat: ncc.get(g.supplier_id)?.vat_rate }) // prettier-ignore
        const meta = poTemplateMeta(template)
        const po = await posService.create(
          user,
          poCreateSchema.parse({
            production_order_id: input.production_order_id,
            supplier_id: g.supplier_id,
            template,
            currency: 'VND',
            vat_rate: md ? md.rate : (meta.vatRate ?? null),
            price_includes_vat: md ? md.incl : meta.priceIncludesVat,
            lines,
          }),
        )
        // Giữ lựa chọn ở bước 2 khớp với đơn vừa tạo.
        await keHoachMuaRepo.upsertChon(
          input.production_order_id,
          g.lines.map((l) => ({
            material_id: l.material_id,
            supplier_id: g.supplier_id,
            price: l.price,
            price_basis: l.co_so,
            note: null,
          })),
          user.id,
        )
        out.tao.push({ id: po.id, code: po.code, supplier_name: tenNcc, so_dong: lines.length, thieu_gia: thieuGia }) // prettier-ignore
      } catch (e) {
        out.loi.push({
          supplier_name: tenNcc,
          loi: e instanceof Error ? e.message : String(e),
        })
      }
    }
    return out
  },

  /**
   * NCC + giá cho file Excel bảng kê — đúng cái màn bước 2 đang hiện: đã lưu,
   * không thì gợi ý của máy (`chonMacDinh`, cùng hàm với màn). Giá đổi về
   * đ/ĐVT mua để công thức SL × giá trong file đúng.
   */
  async luaChonChoExcel(bk: LsxBangKe): Promise<Map<string, LuaChonExcel>> {
    const mas = maCanChonCua(bk)
    const n = await this.nguonNcc(bk.lsx.id, mas)
    const daLuu = new Map(n.chon.map((c) => [c.material_id, c]))
    const out = new Map<string, LuaChonExcel>()
    for (const m of mas) {
      const c = daLuu.get(m.material_id)
      const chon = c
        ? { supplier_name: c.supplier_name, price: c.price, co_so: c.price_basis }
        : chonMacDinh(n.goiY[m.material_id] ?? [], m.unit, sameUnit)
      if (!chon) continue
      const kg = n.kgMoiDv[m.material_id]
      const giaDv =
        chon.price == null ? null : chon.co_so === 'unit' ? chon.price : kg ? Math.round(chon.price * kg) : null // prettier-ignore
      const phu =
        chon.co_so === 'kg' && chon.price != null
          ? ` · ${chon.price.toLocaleString('vi-VN')} đ/kg${giaDv == null ? ' (chưa đổi ra ĐVT — thiếu kg/cây)' : ''}`
          : ''
      out.set(m.material_id, {
        supplier_name: chon.supplier_name,
        gia_dv: giaDv,
        ghi_chu: `${c ? 'đã chọn' : 'máy gợi ý'}${phu}`,
      })
    }
    return out
  },

  async luuChon(user: User, input: ChonNccUpsertInput): Promise<void> {
    await assertCanEdit(user)
    await assertLsx(input.production_order_id)
    // Cùng mã lặp trong payload → lấy dòng cuối (upsert không nhận trùng khoá).
    const byMat = new Map(input.rows.map((r) => [r.material_id, r]))
    await keHoachMuaRepo.upsertChon(
      input.production_order_id,
      [...byMat.values()].map((r) => ({
        material_id: r.material_id,
        supplier_id: r.supplier_id,
        price: r.price,
        price_basis: r.price_basis,
        note: r.note?.trim() ? r.note.trim() : null,
      })),
      user.id,
    )
  },

  async xoaChon(user: User, input: ChonNccDeleteInput): Promise<void> {
    await assertCanEdit(user)
    await assertLsx(input.production_order_id)
    await keHoachMuaRepo.xoaChon(input.production_order_id, input.material_ids)
  },
}
