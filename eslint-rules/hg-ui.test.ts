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

/*
  B3 (24/09/2026) — thang chữ + khoảng cách của kit.

  Luật TỰ DÒ phạm vi: chỉ file thuộc hệ kit (import `@/components/kit`, hoặc nằm
  trong `components/kit/`). Nên các ca dưới đây có cặp đối xứng: cùng một chuỗi,
  file kit thì LỖI, file hệ cũ thì HỢP LỆ. Thiếu cặp đó thì không biết luật im
  vì đúng phạm vi hay im vì hỏng.
*/
const kit = (jsx: string) => `import { Btn } from '@/components/kit'\n${wrap(jsx)}`

ruleTester.run('no-arbitrary-size', hgUi.rules['no-arbitrary-size'], {
  valid: [
    kit('<p className="text-k-sm text-[var(--ink-2)]" />'),
    kit('<b className="text-k-label uppercase" />'),
    // Màn hệ cũ: px gõ cứng CHƯA bị canh — đó là việc của B8, không phải lỗi.
    wrap('<p className="text-[12px]" />'),
    // Màu qua token KHÔNG bị nhầm thành cỡ chữ.
    kit('<p className="text-[var(--ink-3)]" />'),
  ],
  invalid: [
    // Cú pháp hỏng bị chặn ở MỌI file — kể cả file hệ cũ.
    {
      code: wrap('<p className="text-[var(--fs-sm)]" />'),
      errors: [{ messageId: 'varSize' }],
    },
    {
      code: kit('<p className="text-[var(--fs-label)]" />'),
      errors: [{ messageId: 'varSize' }],
    },
    { code: kit('<p className="text-[11.5px]" />'), errors: [{ messageId: 'pxSize' }] },
    // Sau tiền tố biến thể vẫn phải bắt.
    { code: kit('<p className="sm:text-[10px]" />'), errors: [{ messageId: 'pxSize' }] },
    // Nằm trong components/kit/ cũng là file kit, dù không import chính nó.
    {
      code: wrap('<p className="text-[13px]" />'),
      filename: 'src/components/kit/Vidu.tsx',
      errors: [{ messageId: 'pxSize' }],
    },
    // Trong template literal (chuỗi lớp ghép).
    {
      code: kit('<p className={`text-[12.5px] ${x}`} />'),
      errors: [{ messageId: 'pxSize' }],
    },
  ],
})

ruleTester.run('no-arbitrary-space', hgUi.rules['no-arbitrary-space'], {
  valid: [
    kit('<div className="px-2 py-1.5 gap-2" />'),
    // Token mật độ không phải px gõ cứng.
    kit('<div className="px-[var(--pad-x)] py-[var(--pad-y)]" />'),
    // Toạ độ (top/left…) và kích thước (w/h/size) KHÔNG thuộc thang khoảng —
    // chúng là vị trí chính xác, cố ý để ngoài luật.
    kit('<span className="-top-[3px] -right-[3px] size-[6px] w-[52px]" />'),
    // Màn hệ cũ chưa bị canh.
    wrap('<div className="px-[9px]" />'),
  ],
  invalid: [
    { code: kit('<div className="px-[9px]" />'), errors: [{ messageId: 'pxSpace' }] },
    { code: kit('<div className="-mt-[3px]" />'), errors: [{ messageId: 'pxSpace' }] },
    { code: kit('<div className="gap-[7px]" />'), errors: [{ messageId: 'pxSpace' }] },
    // Biến thể lồng kiểu `[&_th]:` — bẫy thật của THead trong kit.
    {
      code: kit('<thead className="[&_th]:py-[7px]" />'),
      errors: [{ messageId: 'pxSpace' }],
    },
    {
      code: kit('<div className="hover:mx-[10px]" />'),
      errors: [{ messageId: 'pxSpace' }],
    },
  ],
})

/*
  Bước icon (24/09/2026). Cặp đối xứng như trên: cùng mã, file kit thì lỗi,
  file hệ cũ thì hợp lệ.
*/
ruleTester.run('kit-icon', hgUi.rules['kit-icon'], {
  valid: [
    kit('<Btn icon="in">In phiếu</Btn>'),
    kit('<Btn icon="duyet" primary>Phê duyệt</Btn>'),
    // Icon làm con cũng được — ca "Ký & sang phiếu sau" có chữ V đứng SAU chữ.
    kit('<Btn>Sau<Ico name="sau" /></Btn>'),
    // Nút huỷ/lùi cố ý trơn.
    kit('<Btn>Thôi</Btn>'),
    kit('<Btn>Để sau</Btn>'),
    // "In" phải là cả chữ: "Inox" không phải động từ in.
    kit('<Btn>Inox 304</Btn>'),
    // Nút chỉ có icon nhưng CÓ tên.
    kit('<Btn aria-label="Phiếu trước"><Ico name="truoc" /></Btn>'),
    // Màn hệ cũ không bị canh (việc của B8).
    `import { Printer } from 'lucide-react'\n${wrap('<Btn>In phiếu</Btn>')}`,
    // Bản đồ khái niệm là nơi DUY NHẤT được import lucide.
    {
      code: `import { Printer } from 'lucide-react'`,
      filename: 'src/components/kit/Icon.tsx',
    },
  ],
  invalid: [
    {
      code: `import { Btn } from '@/components/kit'\nimport { Stamp } from 'lucide-react'`,
      errors: [{ messageId: 'direct' }],
    },
    { code: kit('<Btn>In phiếu</Btn>'), errors: [{ messageId: 'missing' }] },
    {
      code: kit('<Btn primary>Ghi sổ chính thức</Btn>'),
      errors: [{ messageId: 'missing' }],
    },
    // Chữ tiếng Việt ở ĐẦU và CUỐI từ: `\b` của JS chỉ hiểu ASCII nên "Xoá",
    // "Về" từng trượt khỏi lượt chuyển — ca này canh lỗi đó.
    { code: kit('<Btn danger>Xoá dòng</Btn>'), errors: [{ messageId: 'missing' }] },
    { code: kit('<Btn>Về danh sách</Btn>'), errors: [{ messageId: 'missing' }] },
    { code: kit('<Btn>+ Soạn đơn</Btn>'), errors: [{ messageId: 'missing' }] },
    { code: kit('<Btn><Ico name="truoc" /></Btn>'), errors: [{ messageId: 'noName' }] },
    // Thanh hành động chứng từ cũng bị canh — đó là chỗ màn Chứng từ để nút.
    { code: kit('<Action>Đảo phiếu</Action>'), errors: [{ messageId: 'missing' }] },
    { code: kit('<Action strong>Sao chép</Action>'), errors: [{ messageId: 'missing' }] },
  ],
})

ruleTester.run('no-dark-variant', hgUi.rules['no-dark-variant'], {
  valid: [
    wrap('<div className="bg-card text-foreground" />'),
    // Chữ "dark" không phải tiền tố biến thể thì không bắt.
    wrap('<div className="theme-dark-ish" title="dark mode đã tắt" />'),
    // Nhắc tới `dark:` trong chữ thường (chú thích, lời văn) — sau dấu hai chấm
    // không có tên lớp thì không phải lớp.
    `const s = 'lớp dark: đã gỡ'`,
    // Biến thể khác vẫn hợp lệ.
    wrap('<div className="hover:bg-accent md:p-4" />'),
  ],
  invalid: [
    {
      code: wrap('<div className="text-foreground dark:text-white" />'),
      errors: [{ messageId: 'dark' }],
    },
    // Đứng ĐẦU chuỗi, trong cn(), và trong template literal.
    { code: `cn('dark:bg-zinc-900 p-2')`, errors: [{ messageId: 'dark' }] },
    {
      code: 'const c = `rounded ${x} dark:border-zinc-700`',
      errors: [{ messageId: 'dark' }],
    },
    // Biến thể lồng + giá trị tuỳ ý.
    { code: `cn('p-2 dark:hover:bg-[#111]')`, errors: [{ messageId: 'dark' }] },
  ],
})
