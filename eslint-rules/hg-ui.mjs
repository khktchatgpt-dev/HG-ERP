/**
 * Luật ESLint riêng của HG-ERP để GIỮ ĐỒNG BỘ GIAO DIỆN.
 *
 * Vì sao cần: convention nằm trong CLAUDE.md là thứ phải NHỚ, nên lượt nào
 * cũng có xác suất trượt — đo ngày 02/09/2026 được 3.285 lượt màu cứng, trong
 * đó có file viết SAU khi chốt theme-v3. Luật ở đây biến convention thành thứ
 * MÁY CHẶN ĐƯỢC, nên nó không phụ thuộc vào trí nhớ của ai (người hay model).
 *
 * Cách thoát hiểm khi thật sự cần: // eslint-disable-next-line hg/<tên-luật>
 * kèm một dòng lý do. Cố ý bắt phải viết lý do — không có thoát hiểm im lặng.
 */

// Bảng màu Tailwind dựng sẵn. Dùng bất kỳ cái nào ở đây nghĩa là đang tự chế
// một thang màu song song với token, và hai thang đó sẽ không bao giờ khớp.
const PALETTE =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|' +
  'teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'

// Thuộc tính màu. \b ở đầu vẫn khớp sau tiền tố biến thể (dark: hover: md:)
// vì dấu hai chấm là ký tự không-phải-từ.
const PROPS =
  'bg|text|border|ring|ring-offset|outline|divide|from|via|to|fill|stroke|' +
  'shadow|decoration|placeholder|caret|accent'

// String.raw: bắt buộc. Template literal thường sẽ nuốt `\b`/`\d` thành ký tự
// điều khiển, và regex hỏng theo kiểu IM LẶNG — luật vẫn chạy, chỉ là không
// bao giờ khớp gì.
const HARDCODED = new RegExp(String.raw`\b(?:${PROPS})-(?:${PALETTE})-(?:50|\d{3})\b`)
const HEX = new RegExp(String.raw`\b(?:${PROPS})-\[#[0-9a-fA-F]{3,8}\]`)

/** Gợi ý token thay thế, theo đúng ngữ nghĩa chứ không theo sắc độ. */
const HINTS = [
  [/^(red|rose)$/, 'trạng thái DỪNG → text-[var(--stop)] / --destructive'],
  [/^(amber|orange|yellow)$/, 'trạng thái CHỜ → text-[var(--warn)]'],
  [/^(green|emerald|teal)$/, 'trạng thái XONG → text-[var(--done)]'],
  [
    /^(sky|blue|indigo|violet|purple)$/,
    'màu hành động → text-[var(--primary)] / bg-accent',
  ],
  [
    /^(slate|gray|zinc|neutral|stone)$/,
    'nền/chữ → bg-card, bg-muted, text-muted-foreground, border',
  ],
]

function hintFor(text) {
  const m = text.match(new RegExp(`(?:${PROPS})-(${PALETTE})-`))
  if (!m) return 'dùng token .theme-v3 thay vì màu Tailwind dựng sẵn'
  for (const [re, msg] of HINTS) if (re.test(m[1])) return msg
  return 'dùng token .theme-v3'
}

/** @type {import('eslint').Rule.RuleModule} */
const noHardcodedColor = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Cấm màu Tailwind dựng sẵn — nguồn màu duy nhất là token .theme-v3',
    },
    schema: [],
    messages: {
      palette:
        'Màu cứng "{{hit}}" — {{hint}}. Xem token ở src/app/globals.css (.theme-v3) hoặc /design-lab.',
      hex: 'Mã hex "{{hit}}" trong class — màu phải đi qua token .theme-v3, đừng gõ thẳng.',
    },
  },
  create(ctx) {
    const check = (node, text) => {
      if (typeof text !== 'string') return
      const p = text.match(HARDCODED)
      if (p)
        return ctx.report({
          node,
          messageId: 'palette',
          data: { hit: p[0], hint: hintFor(text) },
        })
      const h = text.match(HEX)
      if (h) ctx.report({ node, messageId: 'hex', data: { hit: h[0] } })
    }
    return {
      Literal: (n) => check(n, n.value),
      TemplateElement: (n) => check(n, n.value.raw),
    }
  },
}

// Thẻ HTML thô mà kit đã có bản chuẩn. Dựng thô = tự chế chiều cao/padding/bo
// góc, và đó chính là thứ làm các màn đứng cạnh nhau bị "so le".
const RAW = {
  table:
    'DataTable từ @/components/erp/DataTable (hoặc Table của shadcn nếu là bảng tĩnh)',
  button: 'Button từ @/components/shadcn/button (action ⋯ thì dùng RowMenu)',
  input: 'Input từ @/components/shadcn/input (ô lọc trên toolbar thì ToolbarInput)',
  select: 'Select từ @/components/shadcn/select (trên toolbar thì ToolbarSelect)',
  textarea: 'Textarea từ @/components/shadcn/textarea',
}

/** @type {import('eslint').Rule.RuleModule} */
const noRawControl = {
  meta: {
    type: 'problem',
    docs: { description: 'Bắt dùng ERP kit / shadcn thay vì thẻ HTML thô' },
    schema: [],
    messages: {
      raw: 'Thẻ <{{tag}}> thô — dùng {{use}}. Kit giữ đồng nhất chiều cao, padding, focus ring và dark mode.',
    },
  },
  create(ctx) {
    return {
      JSXOpeningElement(node) {
        if (node.name.type !== 'JSXIdentifier') return
        const use = RAW[node.name.name]
        if (use)
          ctx.report({
            node: node.name,
            messageId: 'raw',
            data: { tag: node.name.name, use },
          })
      },
    }
  },
}

const hgUiPlugin = {
  meta: { name: 'hg-ui' },
  rules: { 'no-hardcoded-color': noHardcodedColor, 'no-raw-control': noRawControl },
}

export default hgUiPlugin
