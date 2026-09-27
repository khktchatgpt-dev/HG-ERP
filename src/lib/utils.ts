import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * BẪY ĐÃ DÍNH (28/09/2026): tailwind-merge không biết thang cỡ chữ riêng của kit
 * (`text-k-label/sm/body/lg/title/doc`, khai ở `@theme` trong CSS) nên coi chúng
 * là lớp MÀU chữ. Gặp `text-[var(--ink-3)]` cùng lệnh `cn(...)` là nó XOÁ cỡ
 * chữ, im lặng: `cn('text-k-sm text-[var(--ink-3)]')` → chỉ còn màu. Mọi ô
 * `Cell muted`, nhãn nhóm, chữ phụ qua `cn` rơi về cỡ chữ nền — nguồn của cảm
 * giác "cỡ chữ lệch nhau giữa các màn". Khai báo thang này là nhóm CỠ CHỮ để
 * nó chỉ đè cỡ chữ khác, không đè màu. Có test canh ở `utils.test.ts`.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ 'text-k': ['label', 'sm', 'body', 'lg', 'title', 'doc'] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
