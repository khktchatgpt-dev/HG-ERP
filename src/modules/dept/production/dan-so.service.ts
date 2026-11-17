import { componentsRepo, type ComponentRow } from './components.repo'
import { productionRepo } from './production.repo'
import { jobsRepo } from './jobs.repo'
import { dayLocksRepo } from './day-locks.repo'
import { lsxLinesRepo } from './lsx-lines.repo'
import { entriesRepo } from './entries.repo'
import { entriesService } from './entries.service'
import { canEditComponents } from './perms'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import type { User } from '@/modules/core/users/users.repo'
import { BadRequest, NotFound } from '@/server/http'
import { calcComponent } from '@/lib/component-needs'
import { chuan, cotNgayMau, khopChiTiet, type CtLenh, type MauTo } from '@/lib/dan-so'
import { componentRoute, routeForGroup } from '@/lib/stage-route'
import { countingOf } from '@/lib/stage-config'
import { resolveCountingPlan } from '@/lib/default-assembly'
import { finishRouteOverride } from '@/lib/finish-stages'
import { resolveTeamStage } from '@/lib/stage-for-dept'
import { vnTodayIso } from '@/lib/local-date'
import type { DanSoInput } from './dan-so.schema'

/**
 * DÁN SỔ EXCEL (bản vẽ 17/11/2026, https://claude.ai/artifact/TN9FdcN5S1mJBDAvwQcsS4,
 * Q1–Q8 duyệt). Nạp số cũ và nhập hằng ngày bằng MỘT lần dán tờ công đoạn.
 *
 * KHÔNG mở đường ghi mới: mỗi ngày có số đi qua đúng `entriesService.record`
 * (một phiếu / ngày / tổ / công đoạn) với cờ `nhapBu` — mọi luật cũ (lộ trình,
 * chốt sổ ngày, ngày tương lai, ô bắt buộc của công đoạn) giữ nguyên. Thêm duy
 * nhất: chi tiết CHƯA có trên lệnh được thêm vào bảng chi tiết (Q3), kể cả khi
 * lệnh đã có sổ — chỉ THÊM, không sửa / xoá dòng cũ.
 *
 * Xem trước và ghi dùng CHUNG một hàm `tinh` — ghi tính lại từ đầu, nên bấm
 * Ghi hai lần thì lần hai chỉ thấy ô "trùng" và bỏ qua.
 */

export type TtO = 'ghi' | 'trung' | 'khac' | 'chot'

export type DongXem = {
  hang: number
  /** khop · moi (sẽ thêm vào bảng chi tiết) · gan (gợi ý) · trung (nhiều cụm) · sai (ô chữ / chặn) · ngoai (mã SP không thuộc lệnh này — bỏ qua, không ghi) */
  kieu: 'khop' | 'moi' | 'gan' | 'trung' | 'sai' | 'ngoai'
  comp_id: string | null
  /** Dòng SP (đợt) đích của chi tiết MỚI — ghi dùng đúng dòng xem trước đã chọn. */
  line_id?: string | null
  /** Tên gợi ý khi `kieu = 'gan'`. */
  gan: string | null
  /** Lý do chặn ghi — chữ người đọc được, kèm cách gỡ. */
  van_de: string[]
  /** Từng ô ngày: sẽ ghi / trùng số đã có / khác số đã có / ngày đã chốt. */
  o: Record<string, { tt: TtO; co?: number }>
  tong_ghi: number
  /** Mã SP nhiều đợt: số được LẤP theo thứ tự đợt — từng đợt nhận bao nhiêu (theo ngày). */
  phan?: { comp_id: string; dot: string; theo_ngay: Record<string, number> }[]
  /** Cần (tính từ lệnh) và đã làm ở công đoạn này — null khi chi tiết mới. */
  can: number | null
  da_lam: number | null
}

export type XemDanSo = {
  dong: DongXem[]
  /** Ngày không dùng được (tương lai) — chặn. */
  cot_loi: { iso: string; loi: string }[]
  tom_tat: {
    o_ghi: number
    ngay_ghi: number
    moi: number
    ngoai: number
    trung: number
    khac: number
    chot: number
    chan: number
  }
  canh_bao: string[]
}

export type KetQuaGhi = {
  phieu: { iso: string; doc_no: string | null; so_o: number; loi: string | null }[]
  moi_tao: number
  canh_bao: string[]
}

export type TuyChonDanSo = {
  today: string
  nam: number
  can_khai: boolean
  stages: { code: string; label: string }[]
  teams: { id: string; name: string; stage: string | null }[]
  lenh: {
    id: string
    code: string
    dong: { id: string; ma: string; ten: string; dot: string; qty: number }[]
  }[]
  mac_dinh: { team: string | null; stage: string | null }
}

async function tai(lsxId: string) {
  const lsx = await productionRepo.findById(lsxId)
  if (!lsx) throw NotFound('Lệnh sản xuất không tồn tại')
  const [components, lines, jobs, stagesCat, existing] = await Promise.all([
    componentsRepo.listByLsx(lsxId),
    lsxLinesRepo.listLines(lsxId),
    jobsRepo.listByLsx(lsxId),
    productionRepo.listStages(),
    entriesRepo.listByLsx(lsxId),
  ])
  const routeByLine = new Map<string, string[]>()
  for (const j of [...jobs].sort((a, b) => a.seq - b.seq)) {
    const arr = routeByLine.get(j.production_order_line_id) ?? []
    arr.push(j.stage)
    routeByLine.set(j.production_order_line_id, arr)
  }
  return { lsx, components, lines, stagesCat, existing, routeByLine }
}

/** Chi tiết có đi qua công đoạn này không — cùng luật với `entriesService.record`. */
function taoLuotDi(
  components: ComponentRow[],
  routeByLine: Map<string, string[]>,
  counting: ReturnType<typeof countingOf>,
  stagesCat: { code: string; label: string }[],
  stage: string,
) {
  const label = stagesCat.find((s) => s.code === stage)?.label ?? stage
  const planCache = new Map<string, ReturnType<typeof resolveCountingPlan>>()
  const planOf = (lineId: string) => {
    let p = planCache.get(lineId)
    if (!p) {
      p = resolveCountingPlan(
        components.filter((c) => c.production_order_line_id === lineId),
        routeByLine.get(lineId),
        counting,
      )
      planCache.set(lineId, p)
    }
    return p
  }
  return (c: ComponentRow): string | null => {
    const eff =
      finishRouteOverride(c, counting.finish) ??
      planOf(c.production_order_line_id).own_route.get(c.id) ??
      componentRoute(routeByLine.get(c.production_order_line_id), c)
    if (eff.length > 0 && !eff.includes(stage)) {
      const ten = (s: string) => stagesCat.find((x) => x.code === s)?.label ?? s
      return `Không đếm ở công đoạn ${label} — khoảng ghi của nó là ${eff
        .map(ten)
        .join(' → ')}; số sau khi ghép cụm thì ghi trên dòng cụm/bộ`
    }
    return null
  }
}

/** Khớp tên; người dùng đã bấm "thêm mới" thì gần-khớp coi là chi tiết mới. */
function khopMoi(r: DanSoInput['rows'][number], ds: CtLenh[]) {
  const k = khopChiTiet(r, ds)
  return k.kieu === 'gan' && r.them_moi ? ({ kieu: 'moi' } as const) : k
}

/** Tính xem trước. Không ghi gì. */
async function tinh(input: DanSoInput, user: User) {
  const { lsx, components, lines, stagesCat, existing, routeByLine } = await tai(
    input.lsx_id,
  )
  if (lsx.status !== 'approved' && lsx.status !== 'in_progress') {
    throw BadRequest('Chỉ nhập sổ cho lệnh đã duyệt / đang sản xuất')
  }
  const stage = stagesCat.find((s) => s.code === input.stage)
  if (!stage) throw BadRequest('Công đoạn không có trong danh mục')
  const counting = countingOf(stagesCat)
  const label = stage.label
  const today = vnTodayIso()
  const canKhai = await canEditComponents(user)

  // Một mã SP có thể nằm trên NHIỀU dòng (tách đợt giao — mỗi đợt một dòng, mỗi dòng một
  // bản bảng chi tiết). Số của file là theo mã, nên mã nhiều đợt buộc chọn đợt ở thanh trên.
  const dongTheoMa = new Map<string, typeof lines>()
  for (const l of lines) {
    // Sổ khách gọi theo MÃ KHÁCH (customer_item_code) — Băng 1 = 2723875 trong file, BN0229HG-IR trên lệnh.
    for (const m of new Set([l.product_code, l.customer_item_code ?? ''])) {
      if (!m) continue
      const k = chuan(m)
      dongTheoMa.set(k, [...(dongTheoMa.get(k) ?? []), l])
    }
  }
  const macDinhLine =
    (input.line_id && lines.find((l) => l.id === input.line_id)) ||
    (lines.length === 1 ? lines[0] : null)

  const luotDi = taoLuotDi(components, routeByLine, counting, stagesCat, input.stage)

  // Số đã có theo (chi tiết × ngày) của đúng tổ + công đoạn; đã làm theo công đoạn.
  const coTheoNgay = new Map<string, number>()
  const daLam = new Map<string, number>()
  for (const e of existing) {
    if (e.stage !== input.stage) continue
    daLam.set(e.component_id, (daLam.get(e.component_id) ?? 0) + Number(e.qty))
    if (e.team_department_id !== input.team_id) continue
    const k = `${e.component_id}|${e.entry_date}`
    coTheoNgay.set(k, (coTheoNgay.get(k) ?? 0) + Number(e.qty))
  }

  const cotLoi: { iso: string; loi: string }[] = []
  const chot = new Set<string>()
  // Sổ Excel hay có cột cho những ngày CHƯA tới (kế hoạch) — chỉ chặn khi cột đó có số.
  const ngayCoSo = new Set(input.rows.flatMap((r) => Object.keys(r.o)))
  for (const iso of input.cot) {
    if (iso > today && ngayCoSo.has(iso)) {
      cotLoi.push({ iso, loi: 'Ngày tương lai — không ghi sổ trước' })
    }
  }
  const ngayCan = new Set(
    input.rows.flatMap((r) => Object.keys(r.o)).filter((d) => d <= today),
  )
  await Promise.all(
    [...ngayCan].map(async (d) => {
      if (await dayLocksRepo.find(input.team_id, d)) chot.add(d)
    }),
  )

  const qtyByLine = new Map(lines.map((l) => [l.id, l.qty]))
  const need = (c: ComponentRow) =>
    calcComponent(
      { qty_per_unit: c.qty_per_unit, dm_kg: c.dm_kg, pcs_per_bar: c.pcs_per_bar },
      qtyByLine.get(c.production_order_line_id) ?? 0,
    ).total_needed

  const tomTat = { o_ghi: 0, ngay_ghi: 0, moi: 0, ngoai: 0, trung: 0, khac: 0, chot: 0, chan: 0 }
  const ngayGhi = new Set<string>()
  const canhBao: string[] = []
  const conLai = new Map<string, number>() // chỗ còn trống của từng chi tiết khi lấp đợt
  const moiCuaDong = new Map<string, number>() // khoá thêm mới → số lần (báo trùng trong file)

  const dong = input.rows.map((r): DongXem => {
    const vanDe: string[] = []
    let line: (typeof lines)[number] | null = null
    let ngoaiLenh = false
    let nhieuDot: typeof lines | null = null
    if (r.ma_sp) {
      const ung = dongTheoMa.get(chuan(r.ma_sp)) ?? []
      if (ung.length === 0) {
        // Sổ Excel gộp NHIỀU lệnh một tờ: mã không thuộc lệnh này thì để nguyên cho lệnh kia.
        ngoaiLenh = true
      } else if (ung.length === 1) {
        line = ung[0]
      } else if (macDinhLine && ung.some((x) => x.id === macDinhLine.id)) {
        line = macDinhLine
      } else {
        nhieuDot = [...ung].sort((a, b) => a.sort_order - b.sort_order)
      }
    } else {
      line = macDinhLine ?? null
      if (!line) vanDe.push('Lệnh có nhiều mã hàng — chọn mã hàng ở thanh trên')
    }
    if (ngoaiLenh) {
      tomTat.ngoai++
      return {
        hang: r.hang,
        kieu: 'ngoai' as const,
        comp_id: null,
        gan: null,
        van_de: [],
        o: {},
        tong_ghi: 0,
        can: null,
        da_lam: null,
      }
    }
    if (nhieuDot) {
      // Mã SP tách nhiều đợt: số của file là theo MÃ → LẤP theo thứ tự đợt (đợt 1 tới khi
      // đủ số cần, rồi đợt 2…; đợt cuối nhận phần dư và bị cảnh báo vượt). Chi tiết chưa có
      // ở đợt nào thì THÊM vào đợt đó (như dán một đợt) — id tạm `moi:<hàng>:<đợt>`.
      const dotTen = (l: (typeof lines)[number]) =>
        l.ship_label ?? l.ship_date ?? `#${l.sort_order + 1}`
      type Dot = { line: (typeof lines)[number]; id: string; comp: ComponentRow | null }
      const cs: Dot[] = []
      let coMoi = false
      let ganMulti: string | null = null
      for (const l of nhieuDot) {
        const ds: CtLenh[] = components
          .filter((c) => c.production_order_line_id === l.id)
          .map((c) => ({ id: c.id, ten: c.name, cum: c.cluster, kind: c.kind }))
        const kk = khopMoi(r, ds)
        if (kk.kieu === 'khop') {
          const c = components.find((x) => x.id === kk.id) ?? null
          if (c) cs.push({ line: l, id: c.id, comp: c })
        } else if (kk.kieu === 'moi') {
          if (!canKhai) {
            vanDe.push('Chưa có trên lệnh và bạn không có quyền thêm vào bảng chi tiết')
            break
          }
          if (!routeForGroup('FRAME').includes(input.stage)) {
            vanDe.push(
              `Chi tiết mới chỉ thêm được ở công đoạn ${routeForGroup('FRAME')
                .map((x) => stagesCat.find((y) => y.code === x)?.label ?? x)
                .join(' · ')}`,
            )
            break
          }
          coMoi = true
          cs.push({ line: l, id: `moi:${r.hang}:${l.id}`, comp: null })
        } else {
          if (kk.kieu === 'gan') ganMulti = kk.ten
          vanDe.push(
            `Đợt ${dotTen(l)}: "${r.ten}" ${kk.kieu === 'gan' ? `gần giống "${kk.ten}" — sửa tên cho khớp` : 'có ở nhiều cụm — dán thêm cột Cụm'}`,
          )
          break
        }
      }
      for (const sa of r.sai) {
        vanDe.push(
          `Ô ${sa.iso.slice(8)}/${sa.iso.slice(5, 7)} "${sa.raw}" không phải số — sửa trong Excel hoặc bỏ ô`,
        )
      }
      const comp0 = cs.find((x) => x.comp)?.comp
      if (vanDe.length === 0 && comp0) {
        const loi = luotDi(comp0)
        if (loi) vanDe.push(`"${comp0.name}": ${loi}`)
      }
      const canCua = (d: Dot) =>
        d.comp
          ? need(d.comp)
          : (r.ct_sp ?? 1) * (qtyByLine.get(d.line.id) ?? 0)
      const lamCua = (d: Dot) => (d.comp ? (daLam.get(d.comp.id) ?? 0) : 0)
      const o: DongXem['o'] = {}
      let tongGhi = 0
      const phan = new Map<string, { comp_id: string; dot: string; theo_ngay: Record<string, number> }>()
      const dauKy = (d: Dot) => conLai.get(d.id) ?? canCua(d) - lamCua(d)
      if (vanDe.length === 0) {
        for (const iso of Object.keys(r.o).sort()) {
          const qty = r.o[iso]
          if (iso > today) continue
          if (chot.has(iso)) {
            o[iso] = { tt: 'chot' }
            tomTat.chot++
            continue
          }
          const co = cs.reduce(
            (t, x) => t + (x.comp ? (coTheoNgay.get(`${x.comp.id}|${iso}`) ?? 0) : 0),
            0,
          )
          if (co > 0) {
            const trung = Math.abs(co - qty) < 1e-9
            o[iso] = { tt: trung ? 'trung' : 'khac', co }
            if (trung) tomTat.trung++
            else tomTat.khac++
            continue
          }
          let con = qty
          cs.forEach((d, i) => {
            if (con <= 0) return
            const cuoi = i === cs.length - 1
            const take = cuoi ? con : Math.min(con, Math.max(0, dauKy(d)))
            if (take <= 0) return
            conLai.set(d.id, dauKy(d) - take)
            con -= take
            const pp = phan.get(d.id) ?? { comp_id: d.id, dot: dotTen(d.line), theo_ngay: {} }
            pp.theo_ngay[iso] = (pp.theo_ngay[iso] ?? 0) + take
            phan.set(d.id, pp)
          })
          o[iso] = { tt: 'ghi' }
          tongGhi += qty
          tomTat.o_ghi++
          ngayGhi.add(iso)
        }
        for (const pp of phan.values()) {
          const d = cs.find((x) => x.id === pp.comp_id)!
          const them = Object.values(pp.theo_ngay).reduce((x, y) => x + y, 0)
          if (canCua(d) > 0 && lamCua(d) + them > canCua(d)) {
            canhBao.push(
              `${r.ten} (đợt ${pp.dot}): sẽ có ${lamCua(d) + them} so với cần ${canCua(d)} — vượt (vẫn ghi được)`,
            )
          }
        }
      }
      if (coMoi && vanDe.length === 0) tomTat.moi++
      if (vanDe.length) tomTat.chan++
      return {
        hang: r.hang,
        kieu: vanDe.length ? (ganMulti && vanDe.length === 1 ? 'gan' : 'sai') : coMoi ? 'moi' : 'khop',
        comp_id: null,
        gan: ganMulti,
        van_de: vanDe,
        o,
        tong_ghi: tongGhi,
        phan: [...phan.values()],
        can: cs.reduce((t, x) => t + canCua(x), 0),
        da_lam: cs.reduce((t, x) => t + lamCua(x), 0),
      }
    }
    for (const s of r.sai) {
      vanDe.push(
        `Ô ${s.iso.slice(8)}/${s.iso.slice(5, 7)} "${s.raw}" không phải số — sửa trong Excel hoặc bỏ ô`,
      )
    }
    const ds: CtLenh[] = line
      ? components
          .filter((c) => c.production_order_line_id === line.id)
          .map((c) => ({ id: c.id, ten: c.name, cum: c.cluster, kind: c.kind }))
      : []
    const k = line ? khopMoi(r, ds) : ({ kieu: 'moi' } as const)
    let kieu: DongXem['kieu'] = vanDe.length ? 'sai' : 'khop'
    let compId: string | null = null
    let gan: string | null = null
    let comp: ComponentRow | null = null
    if (line) {
      if (k.kieu === 'khop') {
        compId = k.id
        comp = components.find((c) => c.id === k.id) ?? null
        const loi = comp ? luotDi(comp) : null
        if (loi) vanDe.push(`"${comp!.name}": ${loi}`)
      } else if (k.kieu === 'gan') {
        gan = k.ten
        kieu = 'gan'
        vanDe.push(`Không có trên lệnh, gần giống "${k.ten}" — nhận gợi ý hoặc sửa tên`)
      } else if (k.kieu === 'trung') {
        kieu = 'trung'
        vanDe.push(`"${r.ten}" có ở nhiều cụm — dán thêm cột Cụm để chọn đúng chi tiết`)
      } else {
        kieu = 'moi'
        if (!canKhai) {
          vanDe.push('Chưa có trên lệnh và bạn không có quyền thêm vào bảng chi tiết')
        } else if (!routeForGroup('FRAME').includes(input.stage)) {
          vanDe.push(
            `Chi tiết mới chỉ thêm được ở công đoạn ${routeForGroup('FRAME')
              .map((s) => stagesCat.find((x) => x.code === s)?.label ?? s)
              .join(' · ')}`,
          )
        } else {
          const kk = `${line.id}|${chuan(r.cum)}|${chuan(r.ten)}`
          moiCuaDong.set(kk, (moiCuaDong.get(kk) ?? 0) + 1)
          if ((moiCuaDong.get(kk) ?? 0) > 1) {
            vanDe.push(`"${r.ten}" xuất hiện hai lần trong file — gộp lại một dòng`)
          }
        }
      }
    }
    if (vanDe.length && kieu === 'khop') kieu = 'sai'

    const o: DongXem['o'] = {}
    let tongGhi = 0
    for (const [iso, qty] of Object.entries(r.o)) {
      if (iso > today) continue
      if (chot.has(iso)) {
        o[iso] = { tt: 'chot' }
        tomTat.chot++
        continue
      }
      const co = comp ? (coTheoNgay.get(`${comp.id}|${iso}`) ?? 0) : 0
      if (co > 0) {
        const trung = Math.abs(co - qty) < 1e-9
        o[iso] = { tt: trung ? 'trung' : 'khac', co }
        if (trung) tomTat.trung++
        else tomTat.khac++
        continue
      }
      o[iso] = { tt: 'ghi' }
      tongGhi += qty
      tomTat.o_ghi++
      ngayGhi.add(iso)
    }
    if (kieu === 'moi') tomTat.moi++
    if (vanDe.length) tomTat.chan++
    const can = comp ? need(comp) : null
    const lam = comp ? (daLam.get(comp.id) ?? 0) : null
    if (comp && can != null && can > 0 && (lam ?? 0) + tongGhi > can) {
      canhBao.push(
        `${comp.name}: sẽ có ${(lam ?? 0) + tongGhi} so với cần ${can} — vượt ${
          (lam ?? 0) + tongGhi - can
        } (vẫn ghi được)`,
      )
    }
    return {
      hang: r.hang,
      kieu,
      comp_id: compId,
      line_id: line?.id ?? null,
      gan,
      van_de: vanDe,
      o,
      tong_ghi: tongGhi,
      can,
      da_lam: lam,
    }
  })
  tomTat.ngay_ghi = ngayGhi.size
  return { dong, cotLoi, tomTat, canhBao, today, lines, macDinhLine, label }
}

export const danSoService = {
  async tuyChon(user: User): Promise<TuyChonDanSo> {
    await assertAction(user, 'production.entries.record')
    const [lenh, depts, stagesCat, canKhai] = await Promise.all([
      productionRepo.listActive(),
      departmentsRepo.list(),
      productionRepo.listStages(),
      canEditComponents(user),
    ])
    const lines = await lsxLinesRepo.listLinesBulk(lenh.map((l) => l.id))
    const teams = depts
      .filter((d) => d.workspace_id === 'production')
      .map((d) => ({ id: d.id, name: d.name, stage: resolveTeamStage(d, stagesCat) }))
    const myTeam = teams.find((t) => t.id === user.department_id) ?? null
    const today = vnTodayIso()
    return {
      today,
      nam: Number(today.slice(0, 4)),
      can_khai: canKhai,
      stages: stagesCat.map((s) => ({ code: s.code, label: s.label })),
      teams,
      lenh: lenh.map((l) => ({
        id: l.id,
        code: l.code,
        dong: lines
          .filter((x) => x.production_order_id === l.id)
          .map((x) => ({
            id: x.id,
            ma: x.product_code,
            ten: x.name_vi ?? x.name_foreign ?? '',
            dot: x.ship_label ?? x.ship_date ?? '',
            qty: x.qty,
          })),
      })),
      mac_dinh: { team: myTeam?.id ?? null, stage: myTeam?.stage ?? null },
    }
  },

  /**
   * Dữ liệu TỜ MẪU (B3): đúng chi tiết lệnh sẽ đếm ở công đoạn này, mỗi mã hàng một
   * tờ; các cột ngày điền sẵn số ĐÃ CÓ của tổ — dán lại không tạo gì thừa.
   */
  async mau(user: User, q: { lsx_id: string; stage: string; team_id: string; line_id?: string }) {
    await assertAction(user, 'production.entries.record')
    const { lsx, components, lines, stagesCat, existing, routeByLine } = await tai(q.lsx_id)
    const stage = stagesCat.find((s) => s.code === q.stage)
    if (!stage) throw BadRequest('Công đoạn không có trong danh mục')
    const luotDi = taoLuotDi(components, routeByLine, countingOf(stagesCat), stagesCat, q.stage)
    const today = vnTodayIso()
    const co = new Map<string, number>()
    const ngay = new Set<string>()
    for (const e of existing) {
      if (e.stage !== q.stage || e.team_department_id !== q.team_id) continue
      const k = `${e.component_id}|${e.entry_date}`
      co.set(k, (co.get(k) ?? 0) + Number(e.qty))
      ngay.add(e.entry_date)
    }
    const cot = cotNgayMau([...ngay], today)
    const to: MauTo[] = []
    for (const l of lines.filter((x) => !q.line_id || x.id === q.line_id)) {
      const cs = components
        .filter((c) => c.production_order_line_id === l.id && !luotDi(c))
        .sort((a, b) => a.sort_order - b.sort_order)
      to.push({
        ten: [l.product_code, l.ship_label ?? l.ship_date ?? ''].join(' ').trim(),
        ma: l.product_code,
        cot,
        dong: cs.map((c) => ({
          cum: c.cluster ?? '',
          ten: c.name,
          ct_sp: Number(c.qty_per_unit),
          can: calcComponent(
            { qty_per_unit: c.qty_per_unit, dm_kg: c.dm_kg, pcs_per_bar: c.pcs_per_bar },
            l.qty,
          ).total_needed,
          o: Object.fromEntries(
            cot.flatMap((iso) => {
              const v = co.get(`${c.id}|${iso}`)
              return v ? [[iso, v]] : []
            }),
          ),
        })),
      })
    }
    return { lsx_code: lsx.code, stage_label: stage.label, to }
  },

  async xem(user: User, input: DanSoInput): Promise<XemDanSo> {
    await assertAction(user, 'production.entries.record')
    const r = await tinh(input, user)
    return { dong: r.dong, cot_loi: r.cotLoi, tom_tat: r.tomTat, canh_bao: r.canhBao }
  },

  async ghi(user: User, input: DanSoInput): Promise<KetQuaGhi> {
    await assertAction(user, 'production.entries.record')
    const r = await tinh(input, user)
    if (r.cotLoi.length > 0) {
      throw BadRequest(`Có cột ngày không ghi được: ${r.cotLoi[0].loi}`)
    }
    if (r.dong.some((d) => d.van_de.length > 0)) {
      throw BadRequest('Còn dòng chưa hợp lệ — sửa hết rồi mới ghi được')
    }

    // 1) Chi tiết mới → bảng chi tiết (chỉ THÊM). Làm trước, ghi sổ sau.
    const moiId = new Map<number, string>()
    for (let i = 0; i < r.dong.length; i++) {
      const d = r.dong[i]
      if (d.kieu !== 'moi') continue
      const row = input.rows[i]
      const line = r.lines.find((l) => l.id === d.line_id) ?? null
      if (!line) continue
      const id = await componentsRepo.insertOne({
        production_order_id: input.lsx_id,
        production_order_line_id: line.id,
        kind: 'part',
        cluster: row.cum || null,
        name: row.ten,
        // Nhóm FRAME = khung, đi phôi → hàn → nguội → sơn: đủ để vào sổ mọi tờ.
        group_code: 'FRAME',
        unit: null,
        qty_per_unit: row.ct_sp ?? 1,
        first_stage: null,
        final_stage: null,
        note: 'Thêm từ Dán sổ Excel',
        dm_kg: row.dm ?? null,
      })
      moiId.set(i, id)
    }

    // 1b) Chi tiết mới của dòng nhiều đợt: mỗi đợt một bản, id tạm → id thật.
    const moiDot = new Map<string, string>()
    for (let i = 0; i < r.dong.length; i++) {
      for (const pp of r.dong[i].phan ?? []) {
        if (!pp.comp_id.startsWith('moi:')) continue
        const lineId = pp.comp_id.split(':')[2]
        const row = input.rows[i]
        const id = await componentsRepo.insertOne({
          production_order_id: input.lsx_id,
          production_order_line_id: lineId,
          kind: 'part',
          cluster: row.cum || null,
          name: row.ten,
          group_code: 'FRAME',
          unit: null,
          qty_per_unit: row.ct_sp ?? 1,
          first_stage: null,
          final_stage: null,
          note: 'Thêm từ Dán sổ Excel',
          dm_kg: row.dm ?? null,
        })
        moiDot.set(pp.comp_id, id)
      }
    }

    // 2) Mỗi ngày một phiếu nhập bù — đi qua đúng đường ghi sổ chính.
    const theoNgay = new Map<string, { component_id: string; qty: number }[]>()
    r.dong.forEach((d, i) => {
      if (d.phan) {
        for (const pp of d.phan) {
          for (const [iso, qty] of Object.entries(pp.theo_ngay)) {
            const arr = theoNgay.get(iso) ?? []
            arr.push({ component_id: moiDot.get(pp.comp_id) ?? pp.comp_id, qty })
            theoNgay.set(iso, arr)
          }
        }
        return
      }
      const id = d.comp_id ?? moiId.get(i)
      if (!id) return
      for (const [iso, o] of Object.entries(d.o)) {
        if (o.tt !== 'ghi') continue
        const arr = theoNgay.get(iso) ?? []
        arr.push({ component_id: id, qty: input.rows[i].o[iso] })
        theoNgay.set(iso, arr)
      }
    })
    const phieu: KetQuaGhi['phieu'] = []
    const canhBao: string[] = [...r.canhBao]
    for (const [iso, entries] of [...theoNgay].sort((a, b) => a[0].localeCompare(b[0]))) {
      try {
        const res = await entriesService.record(
          user,
          input.lsx_id,
          {
            stage: input.stage,
            entry_date: iso,
            team_department_id: input.team_id,
            submit: true,
            note: 'Nhập bù từ sổ Excel',
            entries,
          },
          { nhapBu: true },
        )
        phieu.push({ iso, doc_no: res.doc_no, so_o: entries.length, loi: null })
        canhBao.push(...res.warnings)
      } catch (e) {
        phieu.push({
          iso,
          doc_no: null,
          so_o: entries.length,
          loi: e instanceof Error ? e.message : 'Không ghi được',
        })
      }
    }
    return { phieu, moi_tao: moiId.size + moiDot.size, canh_bao: [...new Set(canhBao)] }
  },
}
