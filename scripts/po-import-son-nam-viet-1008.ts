/**
 * ĐƠN SƠN 1 THÀNH PHẦN — CÔNG TY CP SX-TM SƠN NAM VIỆT (08/10/2026) — NHÁP cho anh Nam Việt.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-import-son-nam-viet-1008.ts           # dò khô
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-import-son-nam-viet-1008.ts --apply   # ghi
 *
 * User 08/10: "lên 1 đơn hàng sơn nháp cho anh Việt, NCC Nam Việt, 20 kg sơn 1 thành phần, dùng sửa
 * mặt bàn cemboard, ghi chú màu sơn giống màu bàn, liên hệ Nam Việt để biết thêm thông tin, giao 10/10".
 *  · Người lập + phụ trách: Nam Việt (viet@hoanggia.de, NV Sales — có quyền đơn mua / NCC / vật tư).
 *  · NCC CHƯA có → tạo mới SNV theo đầu báo giá 01/09/2026 (MST 3703171734, email namvietpaintcompany@gmail.com).
 *  · Vật tư CHƯA có → tạo SON0342 "Sơn 1 thành phần", Kg, nhóm Sơn - keo - hoá chất.
 *  · Không gắn lệnh (hàng sửa mặt bàn), đơn giá để trống — chờ báo giá.
 * Tạo qua service, đứng tên anh Nam Việt; chống nạp đôi theo ghi chú đơn của NCC.
 */
import { db } from '@/server/db'
import { posService } from '@/modules/dept/supply/pos.service'
import { poCreateSchema } from '@/modules/dept/supply/pos.schema'
import { suppliersService } from '@/modules/dept/supply/suppliers.service'
import { supplierCreateSchema } from '@/modules/dept/supply/suppliers.schema'
import { materialsService } from '@/modules/dept/warehouse/warehouse.service'
import { usersRepo } from '@/modules/core/users/users.repo'

const APPLY = process.argv.includes('--apply')
const MST = '3703171734'
const MA_NCC = 'SNV'
const MA_VT = 'SON0342'
const HEN_GIAO = '2026-10-10'
const GHI_CHU_DON =
  'Sơn sửa mặt bàn cemboard. Liên hệ anh Nam Việt để biết thêm thông tin.'

async function first<T>(q: PromiseLike<{ data: unknown }>): Promise<T | null> {
  const { data } = await q
  return ((data as T[] | null) ?? [])[0] ?? null
}

async function main() {
  const viet = (await usersRepo.list()).find((u) => u.email === 'viet@hoanggia.de')
  if (!viet) throw new Error('thiếu anh Nam Việt')
  const ncc = await first<{ id: string; code: string }>(db().from('supply_suppliers').select('id, code').eq('tax_no', MST)) // prettier-ignore
  const vt = await first<{ id: string; code: string }>(db().from('warehouse_materials').select('id, code').eq('code', MA_VT)) // prettier-ignore
  if (ncc) {
    const da = await first<{ code: string }>(db().from('supply_purchase_orders').select('code').eq('supplier_id', ncc.id).eq('note', GHI_CHU_DON)) // prettier-ignore
    if (da) return console.log(`ĐÃ NẠP: ${da.code} — dừng.`)
  }
  const mau = await first<{ group_name: string; sub_group: string | null }>(db().from('warehouse_materials').select('group_name, sub_group').eq('code', 'SON0137')) // prettier-ignore
  console.log(`NCC: ${ncc ? `dùng lại ${ncc.code}` : `TẠO MỚI ${MA_NCC} — Công ty CP SX-TM Sơn Nam Việt`}`) // prettier-ignore
  console.log(`Vật tư: ${vt ? `dùng lại ${vt.code}` : `TẠO MỚI ${MA_VT} Sơn 1 thành phần · Kg · ${mau?.group_name} / ${mau?.sub_group ?? '—'}`}`) // prettier-ignore
  console.log(`Dòng: 20 Kg · chưa giá · hẹn giao ${HEN_GIAO} · người lập ${viet.name}`)
  if (!APPLY) return console.log('Dò khô — thêm --apply để ghi.')

  const nccId =
    ncc?.id ??
    (
      await suppliersService.create(
        viet,
        supplierCreateSchema.parse({
          code: MA_NCC,
          name: 'CÔNG TY CỔ PHẦN SX-TM SƠN NAM VIỆT',
          short_name: 'Sơn Nam Việt',
          type: 'Sơn',
          tax_no: MST,
          address:
            '71/14 Đường ĐX 01, Tổ 9, Khu phố Tân Hóa, Phường Tân Khánh, TP Hồ Chí Minh',
          email: 'namvietpaintcompany@gmail.com',
        }),
      )
    ).id
  const vtId =
    vt?.id ??
    (
      await materialsService.create(viet, {
        code: MA_VT,
        name: 'Sơn 1 thành phần',
        unit: 'Kg',
        group_name: mau?.group_name ?? 'Sơn - keo - hoá chất',
        sub_group: mau?.sub_group ?? undefined,
      })
    ).id

  const po = await posService.create(
    viet,
    poCreateSchema.parse({
      production_order_id: null,
      supplier_id: nccId,
      template: 'accessory',
      currency: 'VND',
      vat_rate: 8,
      price_includes_vat: false,
      expected_at: HEN_GIAO,
      note: GHI_CHU_DON,
      lines: [
        {
          material_id: vtId,
          qty_ordered: 20,
          unit_price: null,
          note: 'Dùng sửa mặt bàn cemboard. Màu sơn giống màu bàn.',
        },
      ],
    }),
  )
  console.log(`✓ ${po.code} (nháp) · NCC ${ncc ? ncc.code : MA_NCC} · ${MA_VT} · hẹn ${po.expected_at}`) // prettier-ignore
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
