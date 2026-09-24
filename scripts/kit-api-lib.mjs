/**
 * TRÍCH API CỦA KIT từ mã nguồn — nguồn cho mục "Thuộc tính" của sách tra
 * `/design-lab/thanh-phan/*` (B7, 24/09/2026 — docs/he-thiet-ke-erp-ke-hoach.md).
 *
 * VÌ SAO TRÍCH TỰ ĐỘNG, KHÔNG VIẾT TAY. Bảng thuộc tính viết tay là thứ lệch
 * khỏi mã NHANH NHẤT trong mọi tài liệu: thêm một prop, đổi mặc định, là bảng
 * nói sai ngay mà không ai hay. Ở đây bảng sinh từ chính kiểu TypeScript + chú
 * thích JSDoc đã có sẵn trong kit, và `kit-api.test.ts` đỏ khi JSON cũ hơn mã.
 *
 * Chỉ lấy thuộc tính KHAI TRONG KIT. `Btn` nhận thêm mọi thuộc tính của thẻ
 * `<button>` — liệt kê 200 thuộc tính HTML là nhiễu, nên chúng gom thành một
 * dòng "mở rộng: ButtonHTMLAttributes".
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ts = require('typescript')

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..') // prettier-ignore
const KIT = path.join(ROOT, 'src', 'components', 'kit')

const la = (p) => p.replace(/\\/g, '/')
const trongKit = (f) => la(f).startsWith(la(KIT) + '/')

/** Đoạn đầu của JSDoc — đủ để đọc trong bảng, phần dài hơn ở mã nguồn. */
function doanDau(s) {
  const t = s
    .trim()
    .split(/\n\s*\n/)[0]
    .replace(/\s+/g, ' ')
    .trim()
  return t.length > 280 ? t.slice(0, 277) + '…' : t
}

/**
 * Chỉ nêu kiểu gốc CỤ THỂ NHẤT: `ButtonHTMLAttributes` đã gồm HTMLAttributes,
 * AriaAttributes, DOMAttributes; không có kiểu cụ thể thì `HTMLAttributes` là đủ.
 */
function gonMoRong(set) {
  const all = [...set]
  const cuThe = all.filter((x) => x !== 'HTMLAttributes' && x.endsWith('HTMLAttributes'))
  if (cuThe.length) return cuThe.sort()
  if (all.includes('HTMLAttributes')) return ['HTMLAttributes']
  return all.sort()
}

function macDinh(fn) {
  const out = {}
  const p = fn.parameters[0]
  if (p && ts.isObjectBindingPattern(p.name)) {
    for (const el of p.name.elements) {
      if (el.initializer) out[el.name.getText()] = el.initializer.getText()
    }
  }
  return out
}

export function extractKitApi() {
  const cfgPath = path.join(ROOT, 'tsconfig.json')
  const cfg = ts.readConfigFile(cfgPath, ts.sys.readFile)
  const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, ROOT)
  const files = fs
    .readdirSync(KIT)
    .filter((f) => f.endsWith('.tsx') && !f.includes('.test.'))
    .map((f) => path.join(KIT, f))
  const program = ts.createProgram(files, { ...parsed.options, noEmit: true })
  const checker = program.getTypeChecker()
  const api = {}

  for (const file of files) {
    const sf = program.getSourceFile(file)
    if (!sf) continue
    for (const st of sf.statements) {
      if (!ts.isFunctionDeclaration(st) || !st.name) continue
      const ten = st.name.text
      const xuat = st.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
      if (!xuat || !/^[A-Z]/.test(ten)) continue
      const p = st.parameters[0]
      const props = []
      const moRong = new Set()
      if (p) {
        const type = checker.getTypeAtLocation(p)
        const defs = macDinh(st)
        for (const sym of checker.getPropertiesOfType(type)) {
          const decl = sym.valueDeclaration ?? sym.declarations?.[0]
          const f = decl?.getSourceFile().fileName ?? ''
          if (!trongKit(f)) {
            // Thuộc tính mượn từ kiểu ngoài (HTML, React) — gom theo tên kiểu cha.
            const cha = decl?.parent
            const tenCha = cha && (ts.isInterfaceDeclaration(cha) || ts.isTypeAliasDeclaration(cha)) ? cha.name.text : null // prettier-ignore
            if (tenCha && !['Attributes', 'RefAttributes'].includes(tenCha))
              moRong.add(tenCha)
            continue
          }
          // Ưu tiên NGUYÊN VĂN kiểu trong mã (`IcoName`, `'thuong' | 'day'`) — trình
          // biên dịch bung bí danh ra thành hợp 60 chuỗi, không ai đọc nổi.
          const t = checker.getTypeOfSymbolAtLocation(sym, decl ?? p)
          let kieu =
            decl && 'type' in decl && decl.type
              ? decl.type.getText().replace(/\s+/g, ' ')
              : checker.typeToString(t, st, ts.TypeFormatFlags.NoTruncation)
          if (sym.flags & ts.SymbolFlags.Optional)
            kieu = kieu.replace(/ \| undefined$/, '')
          if (kieu.length > 90) kieu = kieu.slice(0, 87) + '…'
          props.push({
            name: sym.name,
            type: kieu,
            optional: !!(sym.flags & ts.SymbolFlags.Optional),
            def: defs[sym.name] ?? null,
            doc: doanDau(ts.displayPartsToString(sym.getDocumentationComment(checker))),
          })
        }
      }
      api[ten] = {
        file: la(path.relative(ROOT, file)),
        props: props.sort((a, b) => Number(a.optional) - Number(b.optional) || a.name.localeCompare(b.name)), // prettier-ignore
        // `ButtonHTMLAttributes` đã gồm HTMLAttributes/Aria/DOM — chỉ nêu cái cụ thể nhất.
        extends: gonMoRong(moRong),
      }
    }
  }
  return Object.fromEntries(Object.entries(api).sort(([a], [b]) => a.localeCompare(b)))
}

export const API_JSON = path.join(
  ROOT,
  'src',
  'app',
  'design-lab',
  '_lab',
  'kit-api.json',
)
