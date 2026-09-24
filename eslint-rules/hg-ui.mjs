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

/* ══════════════════════════════════════════════════════════════════════
   THANG CHỮ + KHOẢNG CÁCH CỦA KIT (B3, 24/09/2026 — docs/he-thiet-ke-erp-ke-hoach.md)

   Vì sao cần: cổng cũ chỉ chặn MÀU gõ cứng, không chặn CỠ và KHOẢNG — nên màu
   giữ được kỷ luật còn cỡ thì trôi. Đo 24/09: tám cỡ chữ trong khoảng 10–13px,
   411 giá trị px gõ cứng trong kit và màn kit.

   PHẠM VI: chỉ file THUỘC hệ kit — nằm trong `components/kit/` hoặc import từ
   `@/components/kit`. Luật tự dò, nên màn hệ cũ (theme v3) không bị đụng và
   KHÔNG cần thêm gì vào `ui-baseline.json` (baseline chỉ được ngắn đi).

   NGOẠI LỆ: lớp `text-` bọc `var(--fs-*)` trong ngoặc vuông bị chặn ở MỌI file, không chỉ file kit — vì
   cách viết đó LUÔN hỏng, ở đâu cũng vậy (xem thông báo `varSize`).

   BẪY (đo 24/09): Tailwind v4 quét MỌI file trong repo, kể cả chú thích và chuỗi
   thông báo ở đây, và sinh lớp từ bất cứ thứ gì trông như lớp. Viết nguyên văn
   dạng ví dụ "ngoặc vuông bọc var(...)" hay "var(--fs-*)" có dấu `...`/`*` là
   Tailwind đẻ ra `color: var(...)` → CSS toàn app KHÔNG biên dịch. Tả bằng lời.
   ══════════════════════════════════════════════════════════════════════ */

const KIT_PATH = /[\\/]components[\\/]kit[\\/]/
const VAR_SIZE = new RegExp(String.raw`\btext-\[var\(--(fs-[a-z-]+)\)\]`)
const PX_SIZE = new RegExp(String.raw`\btext-\[(\d+(?:\.\d+)?)px\]`)
const SPACE_PROPS =
  'p|px|py|pt|pb|pl|pr|ps|pe|m|mx|my|mt|mb|ml|mr|ms|me|gap|gap-x|gap-y|space-x|space-y'
const PX_SPACE = new RegExp(String.raw`\b(?:${SPACE_PROPS})-\[(\d+(?:\.\d+)?)px\]`)

/** Bậc chữ gần nhất — cùng bảng với lượt chuyển đổi B3. */
function sizeFor(px) {
  if (px <= 11) return 'text-k-label (11px)'
  if (px <= 12.5) return 'text-k-sm (12px)'
  if (px <= 14) return 'text-k-body (13px)'
  if (px <= 16) return 'text-k-lg (15px)'
  if (px <= 20) return 'text-k-title (18px)'
  return 'text-k-doc (24px)'
}

/** Bậc khoảng Tailwind: số chẵn giữ nguyên, số lẻ về bội số 4 gần nhất. */
function stepFor(px) {
  if (px === 1) return 'px (1px)'
  let n = Math.round(px)
  if (n % 2 === 1) n = Math.round(n / 4) * 4 || 4
  return `${n / 4} (${n}px)`
}

function isKitFile(ctx) {
  const body = ctx.sourceCode?.ast?.body ?? []
  return (
    KIT_PATH.test(ctx.filename ?? '') ||
    body.some(
      (s) => s.type === 'ImportDeclaration' && s.source.value === '@/components/kit',
    )
  )
}

/** @type {import('eslint').Rule.RuleModule} */
const noArbitrarySize = {
  meta: {
    type: 'problem',
    docs: { description: 'Cỡ chữ trong hệ kit phải đi qua thang 5 bậc text-k-*' },
    schema: [],
    messages: {
      varSize:
        '"{{hit}}" KHÔNG có tác dụng: Tailwind v4 hiểu lớp `text-` bọc `var()` trong ngoặc vuông là MÀU, không phải cỡ chữ — chữ sẽ hiện theo cỡ của phần tử cha. Dùng lớp {{use}}.',
      pxSize:
        'Cỡ chữ gõ cứng "{{hit}}" — dùng {{use}}. Thang kit có 5 bậc: 11 · 12 · 13 · 15 · 18 (+24 số chứng từ).',
    },
  },
  create(ctx) {
    let kit = false
    const VAR_USE = {
      'fs-label': 'text-k-label',
      'fs-micro': 'text-k-label',
      'fs-sm': 'text-k-sm',
      'fs-num-sm': 'text-k-sm',
      'fs-body': 'text-k-body',
      'fs-num': 'text-k-body',
      'fs-section': 'text-k-body',
      'fs-lg': 'text-k-lg',
      'fs-num-lg': 'text-k-lg',
      'fs-title': 'text-k-title',
      'fs-doc': 'text-k-doc',
    }
    const check = (node, text) => {
      if (typeof text !== 'string') return
      const v = text.match(VAR_SIZE)
      if (v)
        return ctx.report({
          node,
          messageId: 'varSize',
          data: { hit: v[0], use: VAR_USE[v[1]] ?? 'text-k-*' },
        })
      if (!kit) return
      const p = text.match(PX_SIZE)
      if (p)
        ctx.report({
          node,
          messageId: 'pxSize',
          data: { hit: p[0], use: sizeFor(Number(p[1])) },
        })
    }
    return {
      Program: () => {
        kit = isKitFile(ctx)
      },
      Literal: (n) => check(n, n.value),
      TemplateElement: (n) => check(n, n.value.raw),
    }
  },
}

/** @type {import('eslint').Rule.RuleModule} */
const noArbitrarySpace = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Khoảng đệm/khe trong hệ kit phải theo thang Tailwind (lưới 4px)',
    },
    schema: [],
    messages: {
      pxSpace:
        'Khoảng gõ cứng "{{hit}}" — dùng bậc {{use}}. Số chẵn giữ nguyên bậc Tailwind, số lẻ về bội số 4 gần nhất.',
    },
  },
  create(ctx) {
    let kit = false
    const check = (node, text) => {
      if (!kit || typeof text !== 'string') return
      const m = text.match(PX_SPACE)
      if (m)
        ctx.report({
          node,
          messageId: 'pxSpace',
          data: { hit: m[0], use: stepFor(Number(m[1])) },
        })
    }
    return {
      Program: () => {
        kit = isKitFile(ctx)
      },
      Literal: (n) => check(n, n.value),
      TemplateElement: (n) => check(n, n.value.raw),
    }
  },
}

/* ══════════════════════════════════════════════════════════════════════
   ICON CỦA KIT (24/09/2026 — bước icon, docs/he-thiet-ke-erp-ke-hoach.md §9.5)

   Vì sao cần: `kit/Icon.tsx` là bản đồ KHÁI NIỆM → hình, nhưng không gì bắt
   phải đi qua nó. Đo 24/09: khái niệm "duyệt" mang BỐN hình trên bốn màn liền
   nhau của cùng một người (búa, con dấu, khiên, dấu tích) — vì ba màn tự
   import thẳng từ `lucide-react`. Và 39/53 màn kit không có icon nào.

   Ba lỗi:
   - `direct`  — import `lucide-react` ngoài `kit/Icon.tsx`.
   - `missing` — `<Btn>`/`<Action>` có nhãn bắt đầu bằng một ĐỘNG TỪ quen thuộc (In, Sửa,
     Xoá, Duyệt, Ghi sổ…) mà không có icon. Chỉ canh động từ có khái niệm rõ;
     nút "Thôi", "Để sau", "Đóng" cố ý trơn — Fiori/Carbon đều để trơn nút huỷ.
   - `noName`  — `<Btn>` chỉ có `<Ico>` mà không có chữ lẫn `aria-label`: một
     nút trình đọc màn hình đọc thành "nút", không hơn.

   Phạm vi tự dò như hai luật thang ở trên (file thuộc hệ kit).
   ══════════════════════════════════════════════════════════════════════ */

/** Động từ → khái niệm. Thứ tự: cụ thể trước chung. Chữ thường, cờ `u`. */
const VERB_ICON = [
  [/^về(?!\p{L})/u, 'quayLai'],
  [/xuất excel/u, 'excel'],
  [/^(in|bản in)(?!\p{L})/u, 'in'],
  [/^sửa(?!\p{L})/u, 'sua'],
  [/^(xoá|xóa)(?!\p{L})/u, 'xoa'],
  [/^(phê duyệt|duyệt|ký)(?!\p{L})/u, 'duyet'],
  [/^trả lại(?!\p{L})/u, 'traLai'],
  [/^gửi(?!\p{L})/u, 'gui'],
  [/^ghi (sổ|sản lượng|chính thức)(?!\p{L})|^ghi$/u, 'ghiSo'],
  [/^lưu nháp(?!\p{L})/u, 'luuNhap'],
  [/^(\+|(soạn|thêm|tạo)(?!\p{L}))/u, 'them'],
  [/^bỏ lọc(?!\p{L})/u, 'boLoc'],
  [/^tìm$/u, 'tim'],
  [/^nhận hàng(?!\p{L})/u, 'nhanHang'],
  [/^nhập kho(?!\p{L})/u, 'nhapKho'],
  [/^xuất kho(?!\p{L})/u, 'xuatKho'],
  [/^‹/u, 'truoc'],
  [/^(sao chép|nhân bản)(?!\p{L})/u, 'saoChep'],
  [/^(huỷ|hủy)(?!\p{L})/u, 'huy'],
  [/^khoá(?!\p{L})/u, 'khoa'],
  [/^đảo phiếu(?!\p{L})/u, 'dao'],
  [/^làm mới(?!\p{L})/u, 'lamMoi'],
]

/** Nút của kit mà luật canh: Btn (nút thường) và Action (thanh hành động chứng từ). */
const ICON_BUTTONS = new Set(['Btn', 'Action'])

const ICON_FILE = /[\\/]components[\\/]kit[\\/]Icon\.tsx$/

/** @type {import('eslint').Rule.RuleModule} */
const kitIcon = {
  meta: {
    type: 'problem',
    docs: { description: 'Icon trong hệ kit đi qua bản đồ khái niệm kit/Icon.tsx' },
    schema: [],
    messages: {
      direct:
        'Import thẳng từ lucide-react — dùng `<Ico name="…" />` hoặc prop `icon` của Btn/Chip. Thiếu khái niệm thì thêm vào src/components/kit/Icon.tsx kèm một dòng lý do: một khái niệm, một hình, cả app.',
      missing:
        'Nút "{{label}}" là hành động quen thuộc nhưng không có icon — thêm icon="{{name}}". Icon là mốc cho mắt quét một thanh 6–8 nút.',
      noName:
        'Nút chỉ có icon mà không có chữ lẫn aria-label — trình đọc màn hình chỉ đọc được "nút". Thêm aria-label.',
    },
  },
  create(ctx) {
    let kit = false
    const isIconFile = ICON_FILE.test(ctx.filename ?? '')
    const attr = (open, name) =>
      open.attributes.some((a) => a.type === 'JSXAttribute' && a.name.name === name)
    return {
      Program: () => {
        kit = isKitFile(ctx)
      },
      ImportDeclaration(node) {
        if (kit && !isIconFile && node.source.value === 'lucide-react')
          ctx.report({ node, messageId: 'direct' })
      },
      JSXElement(node) {
        if (!kit) return
        const open = node.openingElement
        if (open.name.type !== 'JSXIdentifier' || !ICON_BUTTONS.has(open.name.name))
          return
        const text = node.children
          .filter((c) => c.type === 'JSXText')
          .map((c) => c.value)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()
        const hasIcoChild = node.children.some(
          (c) =>
            c.type === 'JSXElement' &&
            c.openingElement.name.type === 'JSXIdentifier' &&
            c.openingElement.name.name === 'Ico',
        )
        const hasExpr = node.children.some(
          (c) =>
            c.type === 'JSXExpressionContainer' &&
            c.expression.type !== 'JSXEmptyExpression',
        )
        if (!text && !hasExpr && hasIcoChild && !attr(open, 'aria-label'))
          return ctx.report({ node: open, messageId: 'noName' })
        if (!text || attr(open, 'icon') || hasIcoChild) return
        const low = text.toLowerCase()
        const hit = VERB_ICON.find(([re]) => re.test(low))
        if (hit)
          ctx.report({
            node: open,
            messageId: 'missing',
            data: { label: text.slice(0, 40), name: hit[1] },
          })
      },
    }
  },
}

/*
  CẤM LỚP `dark:` (24/09/2026). Chế độ tối TẮT từ 06/08/2026; `@custom-variant
  dark` ở globals.css buộc lớp `dark:` chỉ bật khi có `.dark` trên cây DOM, mà
  không nơi nào gắn. 1.207 lớp `dark:` / 121 file từng nằm đó: 253 luật CSS
  (~33 KB) mà không bao giờ có tác dụng, và mỗi màn mới chép theo thói quen lại
  đẻ thêm. Gỡ sạch một lượt; luật này giữ cho con số ở 0.

  Bật lại chế độ tối (câu Q3 của docs/he-thiet-ke-erp-ke-hoach.md) thì làm bằng
  TOKEN ở kit/tokens.css — đổi biến màu theo `.dark`, không rải lớp `dark:` lên
  từng thẻ. Đó là lý do luật này cấm hẳn chứ không chỉ cảnh báo.
*/
const DARK = new RegExp(
  String.raw`(?:^|[\s"'` + '`' + String.raw`])(dark:[^\s"'` + '`' + String.raw`]+)`,
)

/** @type {import('eslint').Rule.RuleModule} */
const noDarkVariant = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Cấm lớp Tailwind dark: — chế độ tối tắt, bật lại thì đi bằng token',
    },
    schema: [],
    messages: {
      dark: 'Lớp "{{hit}}" không bao giờ có tác dụng: chế độ tối đang TẮT (globals.css). Bỏ đi. Muốn có chế độ tối thì đổi TOKEN ở kit/tokens.css, không rải lớp dark: lên từng thẻ.',
    },
  },
  create(ctx) {
    const check = (node, text) => {
      if (typeof text !== 'string') return
      const m = text.match(DARK)
      if (m) ctx.report({ node, messageId: 'dark', data: { hit: m[1] } })
    }
    return {
      Literal: (n) => check(n, n.value),
      TemplateElement: (n) => check(n, n.value.raw),
    }
  },
}

const hgUiPlugin = {
  meta: { name: 'hg-ui' },
  rules: {
    'no-dark-variant': noDarkVariant,
    'no-hardcoded-color': noHardcodedColor,
    'no-raw-control': noRawControl,
    'no-arbitrary-size': noArbitrarySize,
    'no-arbitrary-space': noArbitrarySpace,
    'kit-icon': kitIcon,
  },
}

export default hgUiPlugin
