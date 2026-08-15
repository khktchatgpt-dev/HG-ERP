import { describe, expect, it } from 'vitest'
import {
  ALLOWED_EXTENSIONS,
  MACRO_EXTENSIONS,
  extensionIssue,
  fileExtension,
  signatureIssue,
} from './file-signature'
import { ALLOWED_MIME } from './file-limits'

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]) // %PDF-1.7
const ZIP = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]) // PK.. (docx/xlsx/pptx)
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const EXE = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0, 0, 0, 0]) // MZ — PE Windows
const OLE2 = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'

describe('fileExtension', () => {
  it('lấy đuôi cuối cùng, không phân biệt hoa thường', () => {
    expect(fileExtension('BKQC - Sofa.XLSX')).toBe('xlsx')
    expect(fileExtension('ban.ve.chi.tiet.pdf')).toBe('pdf')
  })

  it('không có dấu chấm = không có đuôi', () => {
    expect(fileExtension('Makefile')).toBe('')
  })
})

describe('extensionIssue', () => {
  it('nhận các đuôi hồ sơ SP dùng thật', () => {
    for (const ext of ['pdf', 'xlsx', 'pptx', 'dwg', 'jpg']) {
      expect(extensionIssue(`ho-so.${ext}`)).toBeNull()
    }
  })

  it('chặn Office có macro và chỉ đúng cách chữa', () => {
    for (const ext of MACRO_EXTENSIONS) {
      const msg = extensionIssue(`bang-ke.${ext}`)
      expect(msg).toContain('macro')
    }
    // Câu chữa phải nêu đuôi an toàn tương ứng, không nói chung chung.
    expect(extensionIssue('a.xlsm')).toContain('.xlsx')
    expect(extensionIssue('a.docm')).toContain('.docx')
    expect(extensionIssue('a.pptm')).toContain('.pptx')
  })

  it('chặn file chạy được — kể cả khi đội lốt tên hiền lành', () => {
    expect(extensionIssue('banve.exe')).toContain('chạy được')
    expect(extensionIssue('huong-dan.bat')).toContain('chạy được')
    // SVG bị bỏ khỏi allowlist ảnh vì chạy được <script>.
    expect(extensionIssue('logo.svg')).not.toBeNull()
  })

  it('file không có đuôi thì không xác định được định dạng', () => {
    expect(extensionIssue('bangke')).toContain('không có phần mở rộng')
  })

  it('đuôi lạ bị từ chối kèm danh sách nhận được', () => {
    expect(extensionIssue('data.dat')).toContain('PDF')
  })
})

describe('signatureIssue — bắt trò đổi đuôi', () => {
  it('file thật khớp định dạng thì cho qua', () => {
    expect(signatureIssue('application/pdf', PDF)).toBeNull()
    expect(signatureIssue(XLSX, ZIP)).toBeNull()
    expect(signatureIssue(PPTX, ZIP)).toBeNull()
    expect(signatureIssue('image/png', PNG)).toBeNull()
    expect(signatureIssue('application/msword', OLE2)).toBeNull()
  })

  it('.exe đổi tên thành .pdf bị chặn — ca chính cần chặn', () => {
    expect(signatureIssue('application/pdf', EXE)).not.toBeNull()
  })

  it('ảnh PNG khai là PDF cũng bị chặn (khai sai, dù file lành)', () => {
    expect(signatureIssue('application/pdf', PNG)).not.toBeNull()
  })

  it('định dạng không có chữ ký ổn định thì bỏ qua, không đoán bừa', () => {
    // text/csv/json là byte tuỳ ý; DWG/DXF mỗi phiên bản CAD một kiểu.
    expect(signatureIssue('text/csv', EXE)).toBeNull()
    expect(signatureIssue('application/json', EXE)).toBeNull()
  })

  it('MIME lạ không khai chữ ký thì không chặn nhầm', () => {
    expect(signatureIssue('application/octet-stream', EXE)).toBeNull()
  })
})

describe('allowlist đuôi ↔ allowlist MIME phải nói cùng một điều', () => {
  it('SVG đã bị bỏ khỏi CẢ HAI (15/08/2026)', () => {
    expect((ALLOWED_MIME as readonly string[]).includes('image/svg+xml')).toBe(false)
    expect((ALLOWED_EXTENSIONS as readonly string[]).includes('svg')).toBe(false)
  })

  it('mọi đuôi Office/PDF/ảnh trong allowlist đều có MIME tương ứng được nhận', () => {
    const need: [string, string][] = [
      ['pdf', 'application/pdf'],
      ['xlsx', XLSX],
      ['pptx', PPTX],
      ['png', 'image/png'],
      ['zip', 'application/zip'],
    ]
    for (const [ext, mime] of need) {
      expect((ALLOWED_EXTENSIONS as readonly string[]).includes(ext)).toBe(true)
      expect((ALLOWED_MIME as readonly string[]).includes(mime)).toBe(true)
    }
  })
})
