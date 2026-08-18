import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { buildGridText } from '@/lib/bom-grid'
import { readWorkbookGrid, readWorkbookImages } from './bom-workbook'

/**
 * Vòng tròn thật: dựng .xlsx bằng exceljs → đọc lại bằng đúng đường code sản
 * phẩm → ra khối text gửi cho mô hình.
 *
 * Chỗ này đáng test hơn cả vì mỗi loại ô (công thức, rich text, ô gộp) trả về
 * một hình dạng khác nhau, và đọc lệch MỘT ô là toàn bộ quy cách sai — đúng cái
 * bẫy `bom-paste.ts` đã vấp một lần với biểu mẫu 28-02-2026.
 */

/** Một khối BOM thu nhỏ, giữ nguyên các nét gây khó của biểu mẫu thật. */
async function sampleWorkbook(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('BOM_MER01')

  // Tiêu đề khối GỘP ngang — giá trị nằm ở ô trái nhất.
  ws.mergeCells('A1:F1')
  ws.getCell('A1').value = 'Quy cách : Nhôm'

  ws.getRow(3).values = ['Stt', 'Parts/ Bộ phận', 'Tên chi tiết', 'Loại', 'Dày', 'Dài']
  ws.getRow(4).values = [1, 'Cụm khung', 'Chân trước', 'Hộp', 1.4, 650]
  // Ô rich text (in đậm một phần) — phải rút về chuỗi phẳng.
  ws.getCell('C5').value = {
    richText: [{ text: 'Tay ' }, { text: 'vịn', font: { bold: true } }],
  }
  ws.getRow(5).getCell(1).value = 2
  ws.getRow(5).getCell(4).value = 'Tròn'
  // Ô CÔNG THỨC — phải lấy kết quả, không lấy chuỗi công thức.
  ws.getCell('F5').value = { formula: 'E4*2', result: 1300 }
  ws.getRow(5).getCell(5).value = 2

  const out = await wb.xlsx.writeBuffer()
  return Buffer.from(out)
}

describe('readWorkbookGrid + buildGridText', () => {
  it('đọc .xlsx thật ra đúng khối text gửi cho mô hình', async () => {
    const grid = buildGridText(await readWorkbookGrid(await sampleWorkbook()))

    expect(grid.sheets).toEqual([{ name: 'BOM_MER01', emitted: 4 }])
    expect(grid.truncated).toEqual([])
    expect(grid.text).toContain('=== Sheet "BOM_MER01"')
    // Tiêu đề khối gộp: giữ ở ô trái nhất, dòng 1.
    expect(grid.text).toContain('1 | Quy cách : Nhôm')
    // Dòng 2 trống bị lược, dòng tiêu đề cột vẫn mang số 3.
    expect(grid.text).toContain('3 | Stt | Parts/ Bộ phận | Tên chi tiết | Loại')
    expect(grid.text).toContain('4 | 1 | Cụm khung | Chân trước | Hộp | 1.4 | 650')
  })

  it('rút rich text về chuỗi phẳng và lấy KẾT QUẢ của ô công thức', async () => {
    const grid = buildGridText(await readWorkbookGrid(await sampleWorkbook()))
    const row5 = grid.text.split('\n').find((l) => l.startsWith('5 |'))
    expect(row5).toBe('5 | 2 |  | Tay vịn | Tròn | 2 | 1300')
    expect(grid.text).not.toContain('E4*2')
  })

  it('ném lỗi khi buffer không phải .xlsx (vd .xls đời cũ)', async () => {
    await expect(readWorkbookGrid(Buffer.from('khong-phai-xlsx'))).rejects.toThrow()
  })
})

/**
 * Ảnh nhúng — dựng workbook có HAI ảnh: một "logo" bé và một "ảnh SP" to hơn.
 * Đúng hình dạng file thật: biểu mẫu hay có logo công ty ở header.
 */
async function workbookWithImages(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('BOM')
  ws.getCell('A1').value = 'x'

  const logo = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC',
    'base64',
  )
  const photo = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAXklEQVR4nO3QMQEAAAgDoC251a3gLzhQwM1KAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIvAaOZQABmn1PxwAAAABJRU5ErkJggg==',
    'base64',
  )
  ws.addImage(wb.addImage({ buffer: logo as never, extension: 'png' }), {
    tl: { col: 0, row: 0 },
    ext: { width: 40, height: 20 },
  })
  ws.addImage(wb.addImage({ buffer: photo as never, extension: 'png' }), {
    tl: { col: 1, row: 7 },
    ext: { width: 220, height: 220 },
  })
  return Buffer.from(await wb.xlsx.writeBuffer())
}

describe('readWorkbookImages', () => {
  /**
   * Canh luật "lấy ảnh LỚN NHẤT". Lấy ảnh ĐẦU TIÊN thì trúng logo công ty, và
   * ảnh đại diện của mọi SP nhập từ BOM sẽ là cái logo — hỏng mà rất khó nhận ra
   * vì trông vẫn "có ảnh".
   */
  it('bỏ qua logo, lấy ảnh sản phẩm to hơn', async () => {
    const img = await readWorkbookImages(await workbookWithImages())
    expect(img).not.toBeNull()
    expect(img!.mime).toBe('image/png')
    expect(img!.extension).toBe('png')
    expect(img!.buffer.byteLength).toBe(151)
  })

  it('file không nhúng ảnh nào thì trả null', async () => {
    expect(await readWorkbookImages(await sampleWorkbook())).toBeNull()
  })
})
