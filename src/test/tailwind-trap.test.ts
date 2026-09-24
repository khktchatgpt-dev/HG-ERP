import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * BẪY TAILWIND QUÉT MỌI FILE — canh bằng máy, không bằng trí nhớ.
 *
 * Tailwind v4 tự dò lớp trong MỌI file không bị gitignore: chú thích, markdown,
 * tài liệu, skill. Một chuỗi TRÔNG như lớp tuỳ ý mà bên trong là CSS sai cú pháp
 * (hàm `var` rỗng, hoặc có ký tự đại diện / dấu ba chấm) thì Tailwind vẫn sinh
 * ra nó, và trình phân tích CSS từ chối CẢ tệp: toàn app mất giao diện.
 *
 * Đã dính HAI lần ngày 24/09/2026: lần đầu trong chú thích ở kit, lần hai trong
 * `.claude/skills/erp-ui/SKILL.md`, ngay trong câu đang cảnh báo chính bẫy này.
 * Lần hai lọt qua một lượt soát bằng grep, vì bộ lọc loại mất dòng có link.
 *
 * Chỉ bắt dạng LÀM VỠ CSS. Dạng như màu hex với dấu ba chấm thì vô hại (Tailwind
 * bỏ qua giá trị màu hỏng), nên không chặn để khỏi báo oan.
 *
 * Cùng ngày đã chữa GỐC: globals.css đặt `source('../')` nên Tailwind nay CHỈ
 * quét `src/` — tài liệu, skill, test lint không còn đổ lớp vào CSS. Test vẫn
 * quét cả repo, CỐ Ý rộng hơn cần: rẻ, và đổi `source` sau này mà quên thì nó
 * vẫn còn canh.
 */
const ROOT = path.resolve(__dirname, '../..')
const TRAP = /[a-z][\w:-]*-\[[^\]\s]*(?:\(\)|var\([^)\]\s]*(?:\*|\.\.\.|…))[^\]\s]*\]/g
const BINARY = /\.(png|jpe?g|gif|ico|webp|xlsx?|pdf|woff2?|ttf|zip|tgz)$/i

describe('bẫy Tailwind quét file', () => {
  it('không file nào chứa chuỗi giống lớp tuỳ ý mà làm vỡ CSS', () => {
    const files = execSync('git ls-files -co --exclude-standard', {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
      .split('\n')
      .filter((f) => f && !BINARY.test(f) && !f.endsWith('tailwind-trap.test.ts'))
    const hits: string[] = []
    for (const f of files) {
      const p = path.join(ROOT, f)
      if (!fs.existsSync(p) || fs.statSync(p).size > 2_000_000) continue
      const lines = fs.readFileSync(p, 'utf8').split('\n')
      lines.forEach((l, i) => {
        for (const m of l.matchAll(TRAP)) hits.push(`${f}:${i + 1}  ${m[0]}`)
      })
    }
    expect(hits, 'diễn đạt bằng chữ, đừng viết ví dụ lớp có var rỗng / ký tự đại diện').toEqual([]) // prettier-ignore
  })

  it('mẫu dò bắt đúng hai chuỗi đã làm vỡ CSS, bỏ qua chuỗi vô hại', () => {
    // Ghép chuỗi lúc chạy để chính file test không tự dính mẫu.
    const bad = [
      'text-' + '[var()]',
      'text-' + '[var(--fs-' + '*)]',
      'p-' + '[var(--sp-...)]',
    ]
    const ok = [
      'text-' + '[#...]',
      'grid-cols-[repeat(auto-fill,minmax(250px,1fr))]',
      'text-k-sm',
    ]
    for (const s of bad) expect(s.match(TRAP), s).not.toBeNull()
    for (const s of ok) expect(s.match(TRAP), s).toBeNull()
  })
})
