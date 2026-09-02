/*
 * Test cho hai luật giao diện.
 *
 * Vì sao luật lint cần test: nó hỏng IM LẶNG. Bản đầu tiên của
 * `no-hardcoded-color` viết regex bằng template literal thường, `\b` bị nuốt
 * thành ký tự backspace nên regex không khớp gì — lint vẫn chạy, vẫn báo "0
 * lỗi", và cả hàng rào là đồ giả. Không có test thì không ai phát hiện.
 *
 * Nên phần quan trọng nhất ở đây là các ca VALID: chúng canh việc luật vẫn
 * BẮT được, chứ không phải im vì hỏng.
 */
import { RuleTester } from 'eslint'
import tsParser from '@typescript-eslint/parser'
import { describe, it } from 'vitest'
import hgUi from './hg-ui.mjs'

// RuleTester của ESLint 9 tự dò `describe`/`it` toàn cục; vitest chạy với
// `globals: false` nên phải đưa vào tay.
RuleTester.describe = describe
RuleTester.it = it

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: { ecmaFeatures: { jsx: true }, sourceType: 'module' },
  },
})

const wrap = (jsx: string) => `const C = () => (${jsx})`

ruleTester.run('no-hardcoded-color', hgUi.rules['no-hardcoded-color'], {
  valid: [
    wrap('<div className="bg-card text-muted-foreground border" />'),
    wrap('<div className="text-[var(--warn)] bg-accent" />'),
    // Tiền tố biến thể trên token thì vẫn hợp lệ.
    wrap('<div className="hover:bg-accent dark:text-foreground" />'),
    // Không phải class màu: đừng bắt nhầm chữ có tên màu.
    wrap('<div className="rounded-xl p-4 shadow-sm" />'),
    wrap('<div title="Đơn hàng màu đỏ" />'),
    // `bg-red` thiếu bậc số không phải class Tailwind hợp lệ.
    wrap('<div className="bg-red" />'),
  ],
  invalid: [
    {
      code: wrap('<div className="bg-zinc-50" />'),
      errors: [{ messageId: 'palette' }],
    },
    // Biến thể dark: — chính là kiểu hay gặp nhất trong nợ cũ.
    {
      code: wrap('<div className="dark:bg-zinc-950" />'),
      errors: [{ messageId: 'palette' }],
    },
    // Trong template literal (clsx/cn), không chỉ literal thường.
    {
      code: 'const c = `px-2 ${x} text-emerald-600`',
      errors: [{ messageId: 'palette' }],
    },
    // Hex gõ thẳng trong class.
    {
      code: wrap('<div className="text-[#2743c4]" />'),
      errors: [{ messageId: 'hex' }],
    },
    // Bậc 2 chữ số (50) và 3 chữ số đều phải bắt.
    {
      code: wrap('<div className="border-amber-300 bg-sky-50" />'),
      errors: [{ messageId: 'palette' }],
    },
  ],
})

ruleTester.run('no-raw-control', hgUi.rules['no-raw-control'], {
  valid: [
    wrap('<Button>Lưu</Button>'),
    wrap('<DataTable rows={rows} />'),
    wrap('<Input value={v} />'),
    // Thẻ thường khác không bị đụng tới.
    wrap('<div><span>x</span></div>'),
  ],
  invalid: [
    { code: wrap('<button>Lưu</button>'), errors: [{ messageId: 'raw' }] },
    { code: wrap('<input value={v} />'), errors: [{ messageId: 'raw' }] },
    { code: wrap('<select><option>a</option></select>'), errors: [{ messageId: 'raw' }] },
    { code: wrap('<table><tbody /></table>'), errors: [{ messageId: 'raw' }] },
    { code: wrap('<textarea />'), errors: [{ messageId: 'raw' }] },
  ],
})
