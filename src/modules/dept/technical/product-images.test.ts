import ExcelJS from 'exceljs'
import JSZip from 'jszip'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { IMPORT_COLUMNS, IMPORT_SHEET, hashDistance, imageRefOf, planImport, type ExistingProduct } from '@/lib/product-import' // prettier-ignore
import { fitForUpload, imageHash, makeThumb, readInCellImages } from './product-images'
import {
  buildProductWorkbook,
  fillWritten,
  readImportRows,
} from './product-import-workbook'

/** Ảnh thử có HOẠ TIẾT (ảnh một màu thì vân tay toàn 0, không phân biệt được). */
async function pattern(
  kind: 'ngang' | 'doc' | 'caro',
  w = 800,
  h = 600,
): Promise<Buffer> {
  const px = Buffer.alloc(w * h * 3)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v =
        kind === 'ngang'
          ? Math.round((x / w) * 255)
          : kind === 'doc'
            ? Math.round((y / h) * 255)
            : ((Math.floor(x / 80) + Math.floor(y / 80)) % 2) * 255
      px.fill(v, (y * w + x) * 3, (y * w + x) * 3 + 3)
    }
  return sharp(px, { raw: { width: w, height: h, channels: 3 } })
    .png()
    .toBuffer()
}

const colNo = (key: string) => IMPORT_COLUMNS.findIndex((c) => c.key === key) + 1

const SOFA: ExistingProduct = {
  id: 'id-sofa',
  code: 'BN0029HG-AL',
  name: 'Imani 3 Seater Sofa',
  customer_name: 'LAURA',
  updated_at: '2026-10-03T01:42:04.794601+00:00',
  locked_at: null,
  product_type: 'BN',
  frame_material: 'AL',
  unit: 'cái',
  image_file_id: '0b6c1f9a-1111-4222-8333-444455556666',
  packing: {},
  tech_spec: {},
}

async function exportWithThumb(img: Buffer) {
  const thumb = await makeThumb(img)
  const ref = `${SOFA.image_file_id}|${await imageHash(thumb)}`
  return buildProductWorkbook(
    [SOFA],
    ['LAURA'],
    new Map([[SOFA.id, { buffer: thumb, ref }]]),
  )
}

describe('vân tay ảnh', () => {
  it('ảnh thu nhỏ / nén lại của cùng ảnh gần như trùng; ảnh khác cách xa', async () => {
    const a = await pattern('ngang')
    const aSmall = await makeThumb(a)
    const aJpeg = await sharp(a).jpeg({ quality: 40 }).toBuffer()
    const b = await pattern('doc')
    const [ha, hs, hj, hb] = await Promise.all([a, aSmall, aJpeg, b].map(imageHash))
    expect(hashDistance(ha, hs)).toBeLessThanOrEqual(4)
    expect(hashDistance(ha, hj)).toBeLessThanOrEqual(4)
    expect(hashDistance(ha, hb)).toBeGreaterThan(20)
  })

  it('ảnh quá lớn thu về 2000px; ảnh vừa giữ nguyên byte', async () => {
    const big = await pattern('caro', 4000, 3000)
    const out = await fitForUpload(big, 'png')
    expect(out.ext).toBe('jpeg')
    expect((await sharp(out.buffer).metadata()).width).toBe(2000)
    const ok = await pattern('caro')
    expect((await fitForUpload(ok, 'png')).buffer).toBe(ok)
  })
})

describe('xuất kèm ảnh → đọc lại', () => {
  it('ảnh thu nhỏ để nguyên → "Không đổi"; cột Ảnh gốc ẩn', async () => {
    const buf = await exportWithThumb(await pattern('ngang'))
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf as unknown as ArrayBuffer)
    const ws = wb.getWorksheet(IMPORT_SHEET)!
    expect(ws.getImages()).toHaveLength(1)
    expect(ws.getColumn(colNo('image_ref')).hidden).toBe(true)
    const r = await readImportRows(buf)
    expect(r.rows[0].images).toHaveLength(1)
    expect(r.rows[0].images![0].preview).toBeUndefined() // không tốn công cho ảnh để nguyên
    expect(planImport(r.rows, [SOFA]).rows[0].action).toBe('same')
  })

  it('dán ảnh khác ĐÈ lên ảnh thu nhỏ → cập nhật ảnh, có ảnh xem trước', async () => {
    const buf = await exportWithThumb(await pattern('ngang'))
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf as unknown as ArrayBuffer)
    const ws = wb.getWorksheet(IMPORT_SHEET)!
    const id = wb.addImage({ buffer: (await pattern('doc')) as unknown as ExcelJS.Buffer, extension: 'png' }) // prettier-ignore
    ws.addImage(id, { tl: { col: colNo('image') - 1 + 0.2, row: 3 + 0.1 }, ext: { width: 80, height: 60 } }) // prettier-ignore
    const edited = Buffer.from(await wb.xlsx.writeBuffer())
    const r = await readImportRows(edited)
    expect(r.rows[0].images).toHaveLength(2)
    const p = planImport(r.rows, [SOFA])
    expect(p.rows[0]).toMatchObject({ action: 'update', newImage: 1 })
    expect(p.rows[0].imagePreview).toMatch(/^data:image\/jpeg;base64,/)
    expect(r.imageBytes.get(4)![1].ext).toBe('png')
  })

  it('ảnh EMF → lỗi nói cách sửa', async () => {
    const buf = await exportWithThumb(await pattern('ngang'))
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf as unknown as ArrayBuffer)
    const ws = wb.getWorksheet(IMPORT_SHEET)!
    ws.getImages().length = 0
    const id = wb.addImage({ buffer: Buffer.from('không phải ảnh') as unknown as ExcelJS.Buffer, extension: 'emf' as 'png' }) // prettier-ignore
    ws.addImage(id, {
      tl: { col: colNo('image') - 1, row: 3 },
      ext: { width: 40, height: 40 },
    })
    const r = await readImportRows(Buffer.from(await wb.xlsx.writeBuffer()))
    const p = planImport(r.rows, [SOFA])
    expect(p.rows[0].action).toBe('error')
    expect(p.rows[0].errors[0].msg).toContain('.emf')
  })

  it('ghi xong: ô Ảnh gốc mang vân tay ảnh mới → tải lại file là "Không đổi"', async () => {
    const photo = await pattern('doc')
    const buf = await exportWithThumb(await pattern('ngang'))
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf as unknown as ArrayBuffer)
    const ws = wb.getWorksheet(IMPORT_SHEET)!
    const id = wb.addImage({
      buffer: photo as unknown as ExcelJS.Buffer,
      extension: 'png',
    })
    ws.addImage(id, { tl: { col: colNo('image') - 1 + 0.2, row: 3 + 0.1 }, ext: { width: 80, height: 60 } }) // prettier-ignore
    const edited = Buffer.from(await wb.xlsx.writeBuffer())
    // Ô có 2 ảnh (thu nhỏ cũ + ảnh mới dán đè) → nhớ CẢ HAI vân tay, như service ghi.
    const r0 = await readImportRows(edited)
    const newRef = imageRefOf('11111111-2222-4333-8444-555566667777', r0.rows[0].images!.map((i) => i.hash)) // prettier-ignore
    expect(newRef.split('|')).toHaveLength(3)
    void photo
    const filled = await fillWritten(edited, [{ row: 4, code: SOFA.code, version: 'v2', imageRef: newRef }]) // prettier-ignore
    const after = {
      ...SOFA,
      updated_at: 'v2',
      image_file_id: '11111111-2222-4333-8444-555566667777',
    }
    const p = planImport((await readImportRows(filled)).rows, [after])
    expect(p.rows[0].action).toBe('same')
  })
})

describe('ảnh "Đặt trong ô" (Excel 365)', () => {
  /** Dựng tay đúng chuỗi tham chiếu richData như Excel 365 ghi. */
  async function withInCellImage(img: Buffer): Promise<Buffer> {
    const base = await buildProductWorkbook([SOFA], ['LAURA'])
    const zip = await JSZip.loadAsync(base)
    const sheetPath = 'xl/worksheets/sheet1.xml'
    let sheet = await zip.file(sheetPath)!.async('string')
    const cellRef = `B4`
    sheet = sheet.replace(/<c r="B4"[^>]*\/>|<c r="B4"[^>]*>[\s\S]*?<\/c>/, '')
    sheet = sheet.replace(
      /(<row r="4"[^>]*>)/,
      `$1<c r="${cellRef}" t="e" vm="1"><v>#VALUE!</v></c>`,
    )
    zip.file(sheetPath, sheet)
    zip.file('xl/media/image9.png', img)
    zip.file(
      'xl/metadata.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><metadata xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:xlrd="http://schemas.microsoft.com/office/spreadsheetml/2017/richdata"><metadataTypes count="1"><metadataType name="XLRICHVALUE" minSupportedVersion="120000"/></metadataTypes><futureMetadata name="XLRICHVALUE" count="1"><bk><extLst><ext uri="{3e2802c4-a4d2-4d8b-9148-e3be6c30e623}"><xlrd:rvb i="0"/></ext></extLst></bk></futureMetadata><valueMetadata count="1"><bk><rc t="1" v="0"/></bk></valueMetadata></metadata>`,
    )
    zip.file(
      'xl/richData/rdrichvaluestructure.xml',
      `<?xml version="1.0" encoding="UTF-8"?><rvStructures xmlns="http://schemas.microsoft.com/office/spreadsheetml/2017/richdata" count="1"><s t="_localImage"><k n="_rvRel:LocalImageIdentifier" t="i"/><k n="CalcOrigin" t="i"/></s></rvStructures>`,
    )
    zip.file(
      'xl/richData/rdrichvalue.xml',
      `<?xml version="1.0" encoding="UTF-8"?><rvData xmlns="http://schemas.microsoft.com/office/spreadsheetml/2017/richdata" count="1"><rv s="0"><v>0</v><v>5</v></rv></rvData>`,
    )
    zip.file(
      'xl/richData/richValueRel.xml',
      `<?xml version="1.0" encoding="UTF-8"?><richValueRels xmlns="http://schemas.microsoft.com/office/spreadsheetml/2022/richvaluerel" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><rel r:id="rId1"/></richValueRels>`,
    )
    zip.file(
      'xl/richData/_rels/richValueRel.xml.rels',
      `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image9.png"/></Relationships>`,
    )
    return zip.generateAsync({ type: 'nodebuffer' })
  }

  it('lần đúng chuỗi tham chiếu → ra ảnh ở đúng hàng/cột', async () => {
    const img = await pattern('caro')
    const buf = await withInCellImage(img)
    const found = await readInCellImages(buf, IMPORT_SHEET)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ row: 4, col: 2, ext: 'png' })
    expect(found[0].buffer.equals(img)).toBe(true)
  })

  it('đi trọn đường đọc file → cập nhật ảnh cho SP', async () => {
    const r = await readImportRows(await withInCellImage(await pattern('caro')))
    const p = planImport(r.rows, [SOFA])
    expect(p.rows[0]).toMatchObject({ action: 'update', newImage: 0 })
  })

  it('file thường (không richData) → không có ảnh trong ô', async () => {
    expect(
      await readInCellImages(await buildProductWorkbook([SOFA], []), IMPORT_SHEET),
    ).toEqual([])
  })
})
