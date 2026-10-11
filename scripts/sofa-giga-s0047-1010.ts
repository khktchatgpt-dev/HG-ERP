/**
 * BỘ SOFA KHUNG NHÔM GIGA (file "S0047HG-AL-SOFA SET KHUNG NHÔM.xlsx") → 8 hồ sơ SP — 10/10/2026.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/sofa-giga-s0047-1010.ts           # dò khô
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/sofa-giga-s0047-1010.ts --apply   # ghi
 *
 * User: "cập nhật lại các sản phẩm này, chia file để lưu tương ứng, cũng như các
 * thông tin người làm là anh Thức".
 *
 * File có 4 tờ hiện (TABLE · BANK I · BANK II · BANK III) — mỗi tờ là định mức
 * của MỘT dáng; mỗi dáng có 2 mã trong lệnh 01/26-27 GIGA: biến thể K (sơn đen)
 * và N (dán giấy BHA-78810) — cùng khung, khác hoàn thiện, nên một tờ áp cho cả
 * hai mã. 4 tờ ẩn (梳妆台, Ghe tron…, Ban Vuong cafe…) là tờ mẫu thừa, BỎ.
 * Ô "Mã Số HG" của cả 4 tờ ghi S0089HG-IR (chép từ mẫu cũ) — KHÔNG dùng để khớp.
 *
 * Mỗi mã:
 *  1. Định mức qua `bomAiService.apply` (mode replace — chạy lại không nhân đôi)
 *     → `addParts`: kiểm quyền, khoá hồ sơ, tính số dẫn xuất. Số trên tờ (kg,
 *     tổng dài, diện tích sơn) đi lọt nguyên văn.
 *  2. File: tách đúng tờ của mã ở mức ZIP (giữ ảnh + định dạng, như
 *     bom-split-workbook.mjs), tự kiểm tên tờ + số dòng, đính doc_type 'bom'.
 *  3. Thuộc tính: KTTT → dài/rộng/cao mm, KTBB → thùng, OP2 → 40HC, khối lượng
 *     khung / thực tế, tổng chiều dài, diện tích sơn, số chi tiết.
 *  4. Người làm = Lê Tú Thức: mọi ghi chép đứng tên anh (service gọi bằng user
 *     của anh → file.owner_id), owner_id + bom_prepared_by, và created_by nếu
 *     đang trống (cùng luật bồi hồ sơ cũ 0179).
 */
import fs from 'node:fs'
import path from 'node:path'
import JSZip from 'jszip'
import * as XLSX from 'xlsx'
import { db } from '@/server/db'
import { usersRepo } from '@/modules/core/users/users.repo'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { bomAiService } from '@/modules/dept/technical/bom-ai.service'
import { productsService } from '@/modules/dept/technical/technical.service'
import { filesService } from '@/modules/core/files/files.service'

const APPLY = process.argv.includes('--apply')
const SRC = 'C:/Users/HP/Downloads/S0047HG-AL-SOFA SET KHUNG NHÔM.xlsx'
const OUT =
  'C:/Users/HP/AppData/Local/Temp/claude/D--HG-ERP/d5e28eba-f6ec-468f-91f2-adbad0e8f933/scratchpad/sofa-giga'
const THUC_EMAIL = 'kythuat1@hoanggia.de'
const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/** Tờ → hai mã (K sơn đen · N dán giấy) — theo lệnh 01/26-27 GIGA. */
const MAP: Record<string, string[]> = {
  TABLE: ['TB0298HG-AL', 'TB0299HG-AL'],
  'BANK I': ['CH0289HG-AL', 'CH0290HG-AL'],
  'BANK II': ['BN0230HG-AL', 'BN0232HG-AL'],
  'BANK III': ['BN0231HG-AL', 'BN0233HG-AL'],
}

type Cell = string | number | null
const s = (v: unknown) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim())
const nodau = (v: unknown) =>
  s(v)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
const num = (v: unknown): number | null => {
  if (v == null || v === '') return null
  const n =
    typeof v === 'number' ? v : parseFloat(String(v).replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
const r4 = (n: number | null) => (n == null ? null : Math.round(n * 10000) / 10000)

/* ── Đọc một tờ ──────────────────────────────────────────────────────────── */
type Line = Record<string, unknown>
type Section = { group_code: string; section_title: string; lines: Line[] }
type Sheet = {
  name: string
  meta: {
    title: string
    kttt: string
    ktbb: string
    frameKg: number | null
    actualKg: number | null
    op: string[]
    totals: {
      qty: number | null
      length_m: number | null
      kg: number | null
      paint_m2: number | null
    }
  }
  sections: Section[]
  warn: string[]
}

const SHAPE: Record<string, string> = {
  hop: 'HOP',
  la: 'LA',
  tron: 'TRON',
  vuong: 'VUONG',
}

function readSheet(name: string, grid: Cell[][]): Sheet {
  const warn: string[] = []
  const at = (r: number, c: number) => grid[r]?.[c] ?? null
  const find = (re: RegExp, from = 0) => {
    for (let r = from; r < grid.length; r++)
      for (let c = 0; c < (grid[r]?.length ?? 0); c++)
        if (re.test(nodau(at(r, c)))) return { r, c }
    return null
  }
  const right = (re: RegExp) => {
    const p = find(re)
    if (!p) return ''
    for (let c = p.c + 1; c < (grid[p.r]?.length ?? 0); c++)
      if (s(at(p.r, c))) return s(at(p.r, c))
    return ''
  }
  const op: string[] = []
  grid
    .slice(0, 16)
    .forEach((row) => row?.forEach((v) => /^OP\d/i.test(s(v)) && op.push(s(v))))
  const actual = find(/^thuc te\s*:/)
  const meta: Sheet['meta'] = {
    title: right(/^ten sp:?$/),
    kttt: right(/^kttt:?$/),
    ktbb: right(/^ktbb:?$/),
    frameKg: num(right(/^khoi luong:?$/)),
    actualKg: actual
      ? num(
          s(at(actual.r, actual.c))
            .replace(/.*:\s*/, '')
            .replace(/kg/i, ''),
        )
      : null,
    op,
    totals: { qty: null, length_m: null, kg: null, paint_m2: null },
  }

  const sections: Section[] = []
  const blank = (r: number) => !(grid[r] ?? []).some((v) => s(v))

  /* Khung: "Quy cách :" → hai dòng tiêu đề → thân tới "Tổng cộng". */
  const fq = find(/^quy cach\s*:$/)
  if (fq) {
    const head = find(/^stt$/, fq.r)!
    const body = head.r + 2 // tiêu đề gộp 2 tầng
    const lines: Line[] = []
    for (let r = body; r < grid.length; r++) {
      const nm = s(at(r, 1))
      if (/^tong cong/.test(nodau(nm))) {
        meta.totals = {
          qty: num(at(r, 7)),
          length_m: num(at(r, 8)),
          kg: num(at(r, 9)),
          paint_m2: num(at(r, 10)),
        }
        break
      }
      if (!nm) continue
      const qty = num(at(r, 7))
      const shape = SHAPE[nodau(at(r, 2))] ?? null
      if (!shape) warn.push(`dòng ${r + 1} "${nm}": loại "${s(at(r, 2))}" không nhận ra`)
      if (qty == null) warn.push(`dòng ${r + 1} "${nm}": KHÔNG ghi số lượng`)
      lines.push({
        part_no: num(at(r, 0)),
        part_name: nm,
        material_kind: 'AL',
        profile_shape: shape,
        dim_a_mm: num(at(r, 3)),
        dim_b_mm: num(at(r, 4)),
        cut_length_mm: num(at(r, 5)),
        bend_waste_mm: num(at(r, 6)),
        qty,
        // NGUYÊN VĂN (user 10/10: "ghi đúng số không chỉnh sửa") — không làm tròn.
        total_length_m: num(at(r, 8)),
        weight_kg: num(at(r, 9)),
        paint_area_m2: num(at(r, 10)),
        wall_thickness_mm: num(at(r, 11)),
        note: s(at(r, 12)) || null,
      })
    }
    sections.push({ group_code: 'FRAME', section_title: s(at(fq.r, fq.c)), lines })
  }

  /* Kính / nệm: STT · Tên · Dày · Rộng · Dài · SL, tới dòng trống. */
  for (const [re, group, kind] of [
    [/^quy cach kinh/, 'PANEL', 'GL'],
    [/^quy cach nem/, 'CUSHION', null],
  ] as const) {
    const p = find(re)
    if (!p) continue
    const title = s(at(p.r, p.c))
    const isCm = (grid[p.r] ?? []).some((v) => /cm/.test(nodau(v)))
    const lines: Line[] = []
    for (let r = p.r + 2; r < grid.length && !blank(r); r++) {
      const nm = s(at(r, 1))
      if (!nm) continue
      // NGUYÊN VĂN: tờ nệm ghi "Quy cách: cm" — giữ đúng số trên tờ, KHÔNG đổi
      // đơn vị (user 10/10: "ghi đúng số không chỉnh sửa"); ghi chú nói đơn vị.
      const mm = (v: unknown) => num(v)
      const qty = num(at(r, 5))
      if (qty == null) warn.push(`${title} dòng ${r + 1} "${nm}": KHÔNG ghi số lượng`)
      lines.push({
        part_no: num(at(r, 0)),
        part_name: nm,
        material_kind: kind,
        dim_a_mm: mm(at(r, 2)),
        dim_b_mm: mm(at(r, 3)),
        cut_length_mm: mm(at(r, 4)),
        qty,
        note: isCm ? 'quy cách theo file: cm' : null,
      })
    }
    if (lines.length) sections.push({ group_code: group, section_title: title, lines })
  }

  /* Vật tư (ngũ kim): STT · Tên · ĐVT · SL/SP · Vật liệu, tới hết. */
  const vt = find(/^vat tu$/)
  if (vt) {
    const lines: Line[] = []
    for (let r = vt.r + 2; r < grid.length; r++) {
      const nm = s(at(r, 1))
      if (!nm) continue
      const qty = num(at(r, 3))
      if (qty == null) warn.push(`Vật tư dòng ${r + 1} "${nm}": KHÔNG ghi số lượng`)
      lines.push({
        part_no: num(at(r, 0)),
        part_name: nm,
        unit: s(at(r, 2)) || null,
        qty,
        material_note: s(at(r, 4)) || null,
      })
    }
    if (lines.length)
      sections.push({ group_code: 'NGU_KIM', section_title: s(at(vt.r, vt.c)), lines })
  }
  return { name, meta, sections, warn }
}

/** "95 x 60 x 34.5 cm" → [95, 60, 34.5] */
const dims3 = (t: string) => {
  const m = t.replace(/,/g, '.').match(/([\d.]+)\s*x\s*([\d.]+)\s*x\s*([\d.]+)/i)
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

/* ── Tách tờ ở mức ZIP (cùng cách bom-split-workbook.mjs) ────────────────── */
async function splitSheet(zip: JSZip, sheetName: string): Promise<Buffer> {
  const text = (p: string) => zip.file(p)!.async('string')
  const wbXml = await text('xl/workbook.xml')
  const wbRels = await text('xl/_rels/workbook.xml.rels')
  const relOf = new Map<string, string>()
  for (const m of wbRels.matchAll(
    /<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/>/g,
  ))
    relOf.set(m[1], m[2].replace(/^\//, '').replace(/^xl\//, ''))
  const tag = [...wbXml.matchAll(/<sheet\b[^>]*\/>/g)]
    .map((m) => m[0])
    .find((t) => t.match(/name="([^"]*)"/)?.[1] === sheetName)
  if (!tag) throw new Error(`không thấy tờ ${sheetName}`)
  const rid = tag.match(/r:id="([^"]+)"/)![1]
  const sheetPath = `xl/${relOf.get(rid)}`
  const keep = new Set(['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', sheetPath]) // prettier-ignore
  for (const p of Object.keys(zip.files))
    if (/^xl\/(styles|sharedStrings)\.xml$/.test(p) || /^xl\/theme\//.test(p) || /^docProps\//.test(p)) keep.add(p) // prettier-ignore
  const sheetRelsPath = sheetPath.replace(/worksheets\//, 'worksheets/_rels/') + '.rels'
  const sheetRels = zip.file(sheetRelsPath) ? await text(sheetRelsPath) : null
  if (sheetRels) {
    keep.add(sheetRelsPath)
    for (const m of sheetRels.matchAll(/Target="([^"]+)"/g)) {
      const t = m[1].replace(/^\.\.\//, 'xl/')
      if (zip.file(t)) keep.add(t)
      if (/drawings\/drawing\d+\.xml$/.test(t)) {
        const dRelsPath = t.replace(/drawings\//, 'drawings/_rels/') + '.rels'
        if (zip.file(dRelsPath)) {
          keep.add(dRelsPath)
          for (const mm of (await text(dRelsPath)).matchAll(/Target="([^"]+)"/g)) {
            const mt = mm[1].replace(/^\.\.\//, 'xl/')
            if (zip.file(mt)) keep.add(mt)
          }
        }
      }
    }
  }
  // Tờ tách ra phải HIỆN (tờ nguồn có thể đang ẩn) và là tờ duy nhất.
  const outTag = tag
    .replace(/sheetId="\d+"/, 'sheetId="1"')
    .replace(/\sstate="[^"]*"/, '')
  const outWbXml = wbXml
    .replace(/<sheets>[\s\S]*?<\/sheets>/, `<sheets>${outTag}</sheets>`)
    .replace(/<definedNames>[\s\S]*?<\/definedNames>/, '') // tên vùng trỏ tờ đã bỏ
    .replace(/activeTab="\d+"/, 'activeTab="0"')
    .replace(/firstSheet="\d+"/, 'firstSheet="0"')
  const outWbRels = wbRels.replace(/<Relationship\b[^>]*\/>/g, (rel) => {
    const id = rel.match(/Id="([^"]+)"/)?.[1]
    const tgt = rel.match(/Target="([^"]+)"/)?.[1] ?? ''
    if (id === rid) return rel
    return /worksheets\/|calcChain/.test(tgt) ? '' : rel
  })
  const outCt = (await text('[Content_Types].xml')).replace(
    /<Override\b[^>]*\/>/g,
    (ov) => {
      const rel = (ov.match(/PartName="([^"]+)"/)?.[1] ?? '').replace(/^\//, '')
      if (/worksheets\//.test(rel) && rel !== sheetPath) return ''
      if (/drawings\//.test(rel) && !keep.has(rel)) return ''
      if (/calcChain/.test(rel)) return ''
      return ov
    },
  )
  const out = new JSZip()
  for (const p of Object.keys(zip.files)) {
    if (!keep.has(p) || zip.files[p].dir) continue
    if (p === 'xl/workbook.xml') out.file(p, outWbXml)
    else if (p === 'xl/_rels/workbook.xml.rels') out.file(p, outWbRels)
    else if (p === '[Content_Types].xml') out.file(p, outCt)
    else out.file(p, await zip.file(p)!.async('nodebuffer'))
  }
  return out.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}

/* ── Chạy ────────────────────────────────────────────────────────────────── */
async function main() {
  const thuc = (await usersRepo.list()).find((u) => u.email === THUC_EMAIL)
  if (!thuc) throw new Error('không thấy tài khoản anh Thức')
  for (const a of ['technical.bom.save', 'technical.product.update'] as const)
    if (!(await canAction(thuc, a))) throw new Error(`${thuc.name} thiếu quyền ${a}`)

  const buf = fs.readFileSync(SRC)
  const wb = XLSX.read(buf, { type: 'buffer' })
  const zip = await JSZip.loadAsync(buf)
  fs.mkdirSync(OUT, { recursive: true })

  const codes = Object.values(MAP).flat()
  const { data: prods, error } = await db()
    .from('technical_products')
    .select('*')
    .in('code', codes)
  if (error) throw new Error(error.message)
  const byCode = new Map((prods ?? []).map((p) => [p.code, p]))
  const missing = codes.filter((c) => !byCode.has(c))
  if (missing.length) throw new Error(`thiếu hồ sơ: ${missing.join(', ')}`)
  for (const p of prods!)
    if (p.locked_at) throw new Error(`${p.code} đang KHOÁ — mở khoá trước`)

  const plan: { sheet: Sheet; file: string; fileBuf: Buffer }[] = []
  for (const name of Object.keys(MAP)) {
    const grid = XLSX.utils.sheet_to_json<Cell[]>(wb.Sheets[name], { header: 1, defval: null, raw: true }) // prettier-ignore
    const sheet = readSheet(name, grid)
    // Tách + tự kiểm: mở lại, đúng 1 tờ, đúng tên, đúng số dòng.
    const fileBuf = await splitSheet(zip, name)
    const back = XLSX.read(fileBuf, { type: 'buffer' })
    const backRows = XLSX.utils.sheet_to_json(back.Sheets[name] ?? {}, { header: 1, defval: null }).length // prettier-ignore
    if (
      back.SheetNames.length !== 1 ||
      back.SheetNames[0] !== name ||
      backRows !== grid.length
    )
      throw new Error(
        `tách tờ ${name} hỏng: ${back.SheetNames.join(',')} · ${backRows}/${grid.length} dòng`,
      )
    const file = `BOM GIGA SOFA SET - ${name}.xlsx`
    fs.writeFileSync(path.join(OUT, file), fileBuf)
    plan.push({ sheet, file, fileBuf })

    // Đối chiếu tổng tờ với tổng dòng đọc được — lệch là đọc sót.
    const fr = sheet.sections.find((x) => x.group_code === 'FRAME')?.lines ?? []
    const sum = (k: string) =>
      Math.round(fr.reduce((a, l) => a + (Number(l[k]) || 0), 0) * 1e4) / 1e4
    const t = sheet.meta.totals
    console.log(`\n=== ${name} → ${MAP[name].join(' + ')} · file ${file} (${(fileBuf.length / 1024).toFixed(0)} KB, tự kiểm OK)`) // prettier-ignore
    console.log(`  KTTT ${sheet.meta.kttt} · KTBB ${sheet.meta.ktbb} · khung ${sheet.meta.frameKg} kg · thực tế ${sheet.meta.actualKg} kg · ${sheet.meta.op.join(' · ')}`) // prettier-ignore
    console.log(`  khung: SL ${sum('qty')}/${t.qty} · dài ${sum('total_length_m')}/${t.length_m} m · kg ${sum('weight_kg')}/${r4(t.kg)} · sơn ${sum('paint_area_m2')}/${r4(t.paint_m2)} m²`) // prettier-ignore
    for (const sec of sheet.sections) {
      console.log(`  [${sec.group_code}] ${sec.lines.length} dòng`)
      for (const l of sec.lines)
        console.log(`     ${l.part_no ?? '·'} ${l.part_name} | ${l.profile_shape ?? ''} ${l.dim_a_mm ?? ''}×${l.dim_b_mm ?? ''}×${l.cut_length_mm ?? ''} δ${l.wall_thickness_mm ?? ''} | SL ${l.qty ?? '—'} ${l.unit ?? ''} | ${l.weight_kg ?? ''}kg ${l.material_note ?? ''}`) // prettier-ignore
    }
    for (const w of sheet.warn) console.log(`  ⚠ ${w}`)
  }

  // Sao lưu trạng thái trước khi ghi.
  const ids = prods!.map((p) => p.id)
  const [parts, files] = await Promise.all([
    db().from('technical_product_parts').select('*').in('product_id', ids),
    db().from('files').select('*').in('product_id', ids).is('deleted_at', null),
  ])
  console.log(`\nHiện có: ${parts.data?.length ?? 0} dòng định mức · ${files.data?.length ?? 0} file trên 8 mã`) // prettier-ignore
  if (!APPLY) {
    console.log(`\nDÒ KHÔ — chưa ghi. File tách ở ${OUT}. Thêm --apply để ghi.\n`)
    return
  }
  // Lượt 2 (ghi nguyên văn) KHÔNG đè bản sao lưu lượt 1 — bản đó giữ trạng thái gốc.
  // Mỗi lượt một bản, không đè bản cũ (bản đầu = trạng thái gốc trước mọi lần nạp).
  const base = 'backups/sofa-giga-s0047-truoc-nap-2026-10-10'
  let n = 1
  while (fs.existsSync(`${base}${n === 1 ? '' : `-lan${n}`}.json`)) n++
  const bak = `${base}${n === 1 ? '' : `-lan${n}`}.json`
  fs.writeFileSync(bak, JSON.stringify({ products: prods, parts: parts.data, files: files.data }, null, 1)) // prettier-ignore
  console.log(`Sao lưu: ${bak}`)

  for (const { sheet, file, fileBuf } of plan) {
    const m = sheet.meta
    const kttt = dims3(m.kttt)
    const ktbb = dims3(m.ktbb)
    const op2 = m.op.map((o) => o.match(/^OP2:\s*(\d+)/i)?.[1]).find(Boolean)
    for (const code of MAP[sheet.name]) {
      const p = byCode.get(code)!
      const r = await bomAiService.apply(thuc, p.id, {
        mode: 'replace',
        sections: sheet.sections.map((x) => ({ ...x, unit_basis: null })),
      })
      const { data: had } = await db().from('files').select('id').eq('product_id', p.id).eq('doc_type', 'bom').eq('filename', file).is('deleted_at', null) // prettier-ignore
      if (!had?.length)
        await filesService.uploadFromServer(thuc, {
          buffer: fileBuf,
          filename: file,
          mime_type: MIME_XLSX as never,
          bucket: 'attachments',
          parent: { kind: 'product', id: p.id },
          doc_type: 'bom',
        })
      const packing = {
        ...((p.packing as Record<string, unknown>) ?? {}),
        ...(ktbb
          ? { carton_l_cm: ktbb[0], carton_w_cm: ktbb[1], carton_h_cm: ktbb[2] }
          : {}),
        ...(op2 ? { loading_40hc: Number(op2) } : {}),
        note: [m.ktbb.replace(/[\d.]+\s*x\s*[\d.]+\s*x\s*[\d.]+\s*cm/i, '').trim(), ...m.op].filter(Boolean).join(' · '), // prettier-ignore
      }
      await productsService.update(thuc, p.id, {
        ...(kttt
          ? { length_mm: kttt[0] * 10, width_mm: kttt[1] * 10, height_mm: kttt[2] * 10 }
          : {}),
        // ĐÚNG SỐ CỦA TỜ (user 10/10: "ghi đúng số không chỉnh sửa"): ô "Khối
        // lượng" + dòng "Tổng cộng", kể cả khi tổng tờ TABLE sót dòng cuối.
        frame_weight_kg: m.frameKg,
        actual_weight_kg: m.actualKg,
        frame_length_m: m.totals.length_m,
        paint_area_m2: m.totals.paint_m2,
        part_count: m.totals.qty,
        packing,
        owner_id: thuc.id,
        bom_prepared_by: thuc.name,
      } as never)
      if (!p.created_by) await db().from('technical_products').update({ created_by: thuc.id }).eq('id', p.id) // prettier-ignore
      console.log(`  ✓ ${code}: +${r.added} dòng (xoá ${r.removed}) · file BOM · thuộc tính · người làm ${thuc.name}`) // prettier-ignore
    }
  }
  console.log('\nXONG.\n')
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error('✗', e instanceof Error ? e.message : e)
    process.exit(1)
  },
)
