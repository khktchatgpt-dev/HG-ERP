/**
 * Luật ESLint riêng của HG-ERP.
 *
 * 30/09/2026: bộ luật canh GIAO DIỆN (no-hardcoded-color, no-raw-control,
 * no-arbitrary-size/space, kit-icon, no-dark-variant) đã GỠ theo quyết định của
 * chủ dự án — chúng làm việc thiết kế và chỉnh sửa màn mới khó hơn cái lợi đồng
 * bộ mang lại. Còn lại một luật thuộc kiến trúc mã, không phải thiết kế.
 *
 * BẪY khi viết luật: regex phải dùng String.raw — template literal thường nuốt
 * /d thành ký tự điều khiển và luật hỏng IM LẶNG (vẫn báo "0 lỗi").
 */

/*
  RANH GIỚI CLIENT / SERVER (28/09/2026).

  `src/modules/*` và `src/server/*` chạy bằng khoá bí mật Supabase — CLAUDE.md cấm
  Client Component import chúng, nhưng lời cấm đó chỉ nằm trên giấy: đo 28/09 có
  12 file `'use client'` import từ `@/modules`, may là 10 file chỉ lấy KIỂU (xoá
  sạch lúc biên dịch) và 2 file lấy hằng số thuần. Luật này biến "may" thành "được
  canh": file client chỉ được `import type` từ hai vùng đó.

  Ngoại lệ có chủ đích — module THUẦN, không chạm DB, client dùng chung được:
    · `*.schema` — zod (dùng lại để kiểm form phía client);
    · `@/modules/core/rbac/actions` — danh mục quyền, chỉ hằng số.
  Hàng rào thứ hai nằm ở `src/server/db.ts` (`import 'server-only'`): module thuần
  nào lỡ kéo DB vào thì BUILD đỏ, kể cả qua đường vòng mà luật này không thấy.
*/
const SERVER_ZONE = /^@\/(?:modules|server)\//
const PURE_OK = [/\.schema$/, /^@\/modules\/core\/rbac\/actions$/]

const isUseClient = (program) =>
  program.body.some(
    (s) => s.type === 'ExpressionStatement' && s.directive === 'use client',
  )
// Import CHỈ mang kiểu: `import type {…}` hoặc mọi specifier đều `type X`.
const typeOnly = (node) =>
  node.importKind === 'type' ||
  node.exportKind === 'type' ||
  (node.specifiers?.length > 0 &&
    node.specifiers.every((s) => s.importKind === 'type' || s.exportKind === 'type'))

/** @type {import('eslint').Rule.RuleModule} */
const clientServerBoundary = {
  meta: {
    type: 'problem',
    docs: {
      description: "File 'use client' chỉ được import KIỂU từ @/modules và @/server",
    },
    schema: [],
    messages: {
      value:
        'File \'use client\' đang lấy GIÁ TRỊ từ "{{src}}" — vùng này chạy bằng khoá bí mật Supabase, không được vào trình duyệt. Chỉ cần kiểu thì viết `import type`. Cần hằng số dùng chung thì dời nó sang src/lib (hoặc file *.schema thuần zod). Cần dữ liệu thì page (server) tải rồi truyền xuống bằng props, hoặc gọi qua api().',
    },
  },
  create(ctx) {
    let client = false
    const check = (node) => {
      if (!client || !node.source) return
      const src = node.source.value
      if (typeof src !== 'string' || !SERVER_ZONE.test(src)) return
      if (typeOnly(node) || PURE_OK.some((re) => re.test(src))) return
      ctx.report({ node, messageId: 'value', data: { src } })
    }
    return {
      Program: (p) => {
        client = isUseClient(p)
      },
      ImportDeclaration: check,
      ExportNamedDeclaration: check,
      ExportAllDeclaration: check,
    }
  },
}

const hgPlugin = {
  meta: { name: 'hg' },
  rules: {
    'client-server-boundary': clientServerBoundary,
  },
}

export default hgPlugin
