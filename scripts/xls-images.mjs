// BÓC ẢNH NHÚNG KHỎI FILE .xls ĐỜI CŨ (BIFF8) + GHÉP ĐÚNG DÒNG.
//
// exceljs chỉ đọc .xlsx; SheetJS đọc được ô của .xls nhưng KHÔNG trả ảnh. Ảnh
// trong BIFF8 nằm ở hai chỗ tách rời nhau, phải nối lại mới dùng được:
//
//   · BYTE ẢNH   — record MSODRAWINGGROUP (0x00EB) ở stream `Workbook`, mỗi
//     record chỉ chứa ~8KB nên bị cắt tiếp bằng CONTINUE (0x003C). Nối hết rồi
//     mới đi cây Escher, vào từng BSE (0xF007), dò chữ ký JPEG/PNG trong ~200
//     byte đầu rồi lấy TỚI HẾT record.
//     BẪY: đừng cắt ở FF D9 — ảnh có thumbnail EXIF sẽ cụt (286KB → 16KB hỏng).
//
//   · NEO DÒNG   — record MSODRAWING (0x00EC) của sheet: trong mỗi SpContainer,
//     `FOPT` (0xF00B) prop 260 = SỐ THỨ TỰ ảnh (1-based, trỏ vào danh sách BSE),
//     `ClientAnchor` (0xF010) offset 6 = DÒNG neo (0-based tính từ đầu SHEET).
//     BẪY: đoán theo thứ tự ảnh xuất hiện là sai — nhiều file chèn lộn xộn.
//
// ⚠ `row` TRẢ VỀ LÀ DÒNG NEO, KHÔNG PHẢI DÒNG SẢN PHẨM. Ảnh dán trong Excel neo
// ở ô chứa GÓC TRÊN-TRÁI của nó, mà người ta hay dán trồi lên nên mép trên rơi
// vào dòng phía trên. Trên file LSX 06.26.27 lệch đúng 1 dòng: ảnh có caption in
// "Msp 26441-217" neo ở dòng của 26443-219. **Luôn dò độ lệch bằng NỘI DUNG**
// (caption trong ảnh, hoặc SP nào chắc chắn có/không có ảnh) rồi mới ghép —
// đừng tin quan hệ 1-1 giữa dòng neo và dòng dữ liệu.
//
// Dùng: `import { readXlsImages } from './xls-images.mjs'`
//   → [{ row, index, buffer, ext }] · `row` 0-based tính từ đầu SHEET.
import { createRequire } from 'node:module'
const XLSX = createRequire(import.meta.url)('xlsx')

const RT = { CONTINUE: 0x003c, MSODRAWINGGROUP: 0x00eb, MSODRAWING: 0x00ec, BOF: 0x0809 }

/** Duyệt record BIFF: [type u16][len u16][data]. */
function* biffRecords(buf) {
  let p = 0
  while (p + 4 <= buf.length) {
    const type = buf.readUInt16LE(p)
    const len = buf.readUInt16LE(p + 2)
    if (p + 4 + len > buf.length) break
    yield { type, data: buf.subarray(p + 4, p + 4 + len) }
    p += 4 + len
  }
}

/**
 * Nối MỌI record `want` + CONTINUE đi kèm thành MỘT khối Escher liền mạch.
 *
 * BẪY: Excel không chỉ cắt bằng CONTINUE — nó còn ghi NHIỀU record cùng loại
 * nối tiếp nhau. Tách mỗi record thành một khối riêng là cắt ngang giữa một
 * record Escher: cây gãy, chỉ đọc được ảnh đầu tiên rồi im (đo trên file LSX
 * 06.26.27: ra 1 ảnh thay vì 24). CONTINUE chỉ được nhận khi đứng ngay sau
 * `want` hoặc sau một CONTINUE của chính chuỗi đó — record khác (SST…) cũng
 * dùng CONTINUE, vơ nhầm là lẫn byte lạ vào ảnh.
 */
function collect(buf, want) {
  const parts = []
  let inChain = false
  for (const r of biffRecords(buf)) {
    if (r.type === want) {
      parts.push(r.data)
      inChain = true
    } else if (r.type === RT.CONTINUE && inChain) {
      parts.push(r.data)
    } else {
      inChain = false
    }
  }
  return parts.length ? [Buffer.concat(parts)] : []
}

/** Duyệt cây Escher; container thì đệ quy vào trong. */
function* escher(buf, depth = 0) {
  let p = 0
  while (p + 8 <= buf.length) {
    const ver = buf.readUInt16LE(p)
    const type = buf.readUInt16LE(p + 2)
    const len = buf.readUInt32LE(p + 4)
    const end = Math.min(p + 8 + len, buf.length)
    const data = buf.subarray(p + 8, end)
    yield { type, data, depth }
    if ((ver & 0x0f) === 0x0f && depth < 8) yield* escher(data, depth + 1)
    p = end
    if (len === 0 && (ver & 0x0f) !== 0x0f) break
  }
}

const SIGS = [
  { ext: 'jpg', sig: Buffer.from([0xff, 0xd8, 0xff]) },
  { ext: 'png', sig: Buffer.from([0x89, 0x50, 0x4e, 0x47]) },
  { ext: 'gif', sig: Buffer.from([0x47, 0x49, 0x46, 0x38]) },
]

/** Byte ảnh theo THỨ TỰ BSE (index 1-based khớp prop 260). */
function blipsOf(workbook) {
  const blips = []
  for (const block of collect(workbook, RT.MSODRAWINGGROUP)) {
    for (const rec of escher(block)) {
      if (rec.type !== 0xf007) continue // BSE
      let found = null
      for (const { ext, sig } of SIGS) {
        const at = rec.data.subarray(0, 220).indexOf(sig)
        if (at >= 0 && (found === null || at < found.at)) found = { at, ext }
      }
      // Cắt tới HẾT record — KHÔNG dừng ở FF D9 (thumbnail EXIF nằm sau).
      if (found) blips.push({ buffer: rec.data.subarray(found.at), ext: found.ext })
    }
  }
  return blips
}

/** Neo ảnh: mỗi SpContainer cho ra { index (prop 260), row (anchor +6) }. */
function anchorsOf(sheetStream) {
  const out = []
  for (const block of collect(sheetStream, RT.MSODRAWING)) {
    let index = null
    let row = null
    for (const rec of escher(block)) {
      if (rec.type === 0xf00b) {
        // FOPT — bảng thuộc tính, mỗi mục 6 byte: id u16 | value u32
        const n = rec.data.length >= 2 ? (rec.data.length / 6) | 0 : 0
        for (let i = 0; i < n; i++) {
          const id = rec.data.readUInt16LE(i * 6) & 0x3fff
          if (id === 260) index = rec.data.readUInt32LE(i * 6 + 2)
        }
      } else if (rec.type === 0xf010 && rec.data.length >= 8) {
        row = rec.data.readUInt16LE(6) // ClientAnchor: flag|col1|dx1|ROW1
      }
      if (index != null && row != null) {
        out.push({ index, row })
        index = null
        row = null
      }
    }
  }
  return out
}

/**
 * Ảnh trong file .xls, kèm dòng neo.
 * @param path đường dẫn file .xls
 * @returns [{ row, index, buffer, ext }] — `row` 0-based tính từ ĐẦU SHEET.
 */
export function readXlsImages(path) {
  const cfb = XLSX.CFB.read(path, { type: 'file' })
  const entry = cfb.FileIndex.find((f) => /^(Workbook|Book)$/i.test(f.name))
  if (!entry) throw new Error('Không thấy stream Workbook — file này không phải BIFF8')
  const wb = Buffer.from(entry.content)

  const blips = blipsOf(wb)
  const anchors = anchorsOf(wb)
  return anchors
    .filter((a) => a.index >= 1 && a.index <= blips.length)
    .map((a) => ({ row: a.row, index: a.index, ...blips[a.index - 1] }))
    .sort((x, y) => x.row - y.row)
}

// Chạy trực tiếp để soi: node scripts/xls-images.mjs <file.xls>
if (process.argv[1] && process.argv[1].endsWith('xls-images.mjs')) {
  const f = process.argv[2]
  if (!f) {
    console.error('Dùng: node scripts/xls-images.mjs <file.xls>')
    process.exit(1)
  }
  for (const img of readXlsImages(f))
    console.log(
      `dòng ${img.row} (1-based ${img.row + 1}) · ảnh #${img.index} · ${img.ext} · ${img.buffer.length} byte`,
    )
}
