// @vitest-environment happy-dom
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { a11yViolations, formatViolations } from '@/test/a11y'
import { DOCS } from '../thanh-phan/_docs'
import kitApi from './kit-api.json'
import { KIT_FAMILIES } from './kit-families'

/**
 * CHỈ TIÊU T8 — MỌI THÀNH PHẦN KIT CÓ TRANG TÀI LIỆU ĐỦ SÁU MỤC (B7, 24/09/2026).
 *
 * Bốn lớp canh, mỗi lớp chặn một cách tài liệu mục đi:
 * 1. Thành phần mới vào kit mà không ghi vào họ nào → đỏ (không ai biết nó có).
 * 2. Họ không có trang, hoặc trang dựng hỏng (demo ném lỗi) → đỏ.
 * 3. Prop không có chú thích nghĩa → đỏ. Bảng thuộc tính sinh từ JSDoc, nên
 *    prop câm là một ô "chưa ghi nghĩa" trên trang.
 * 4. Trang khai "đã kiểm bằng test X" mà X không tồn tại → đỏ.
 *
 * Kèm `axe` trên từng trang: các ví dụ sống là mã thật, dựng sai nhãn ở đây thì
 * người chép ví dụ sang màn thật chép luôn cái sai.
 */

afterEach(cleanup)

const API = kitApi as Record<string, { props: { name: string; doc: string }[] }>
const ROOT = path.resolve(__dirname, '../../../..')
const SIX = ['khi-nao', 'bien-the', 'thuoc-tinh', 'trang-thai', 'truy-cap', 'nen-dung']

describe('sổ họ thành phần', () => {
  it('mọi thành phần kit thuộc ĐÚNG MỘT họ', () => {
    const count = new Map<string, number>()
    for (const f of KIT_FAMILIES)
      for (const m of f.members) count.set(m, (count.get(m) ?? 0) + 1)
    const thieu = Object.keys(API).filter((c) => !count.has(c))
    const trung = [...count].filter(([, n]) => n > 1).map(([c]) => c)
    const ma = [...count.keys()].filter((c) => !(c in API))
    expect(thieu, 'thành phần chưa có họ — thêm vào kit-families.ts').toEqual([])
    expect(trung, 'thành phần nằm ở hai họ').toEqual([])
    expect(ma, 'họ nhắc tới tên không có trong kit').toEqual([])
  })

  it('slug không trùng, và mỗi họ một trang', () => {
    const slugs = KIT_FAMILIES.map((f) => f.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    expect(Object.keys(DOCS).sort()).toEqual([...slugs].sort())
  })

  it('bảng "cần gì → dùng gì" của skill erp-ui nhắc đủ mọi họ', () => {
    // Skill là chỗ agent tìm thành phần khi dựng màn. Họ mới mà không có dòng ở
    // đây thì agent không biết nó tồn tại và sẽ tự chế CSS tại chỗ.
    const md = fs.readFileSync(
      path.join(ROOT, '.claude/skills/erp-ui/references/tra-thanh-phan.md'),
      'utf8',
    )
    const thieu = KIT_FAMILIES.filter((f) => !md.includes('`' + f.slug + '`'))
    expect(
      thieu.map((f) => f.slug),
      'thêm dòng vào tra-thanh-phan.md',
    ).toEqual([])
  })

  it('mọi prop đều có chú thích nghĩa (JSDoc trên khai báo kiểu)', () => {
    const cam = Object.entries(API).flatMap(([c, e]) =>
      e.props.filter((p) => !p.doc.trim()).map((p) => `${c}.${p.name}`),
    )
    expect(cam, 'prop chưa có JSDoc — viết chú thích rồi `npm run kit:api`').toEqual([])
  })
})

describe('trang tài liệu', () => {
  for (const f of KIT_FAMILIES) {
    it(`${f.slug}: dựng được, đủ sáu mục, không lỗi truy cập`, async () => {
      const D = DOCS[f.slug]
      expect(D, `thiếu _docs/${f.slug}.tsx`).toBeTruthy()
      const { container } = render(<D />)
      const thieu = SIX.filter((id) => !container.querySelector(`section#${id}`))
      expect(thieu, 'mục còn thiếu').toEqual([])
      const t = container.querySelector('[data-tested]')?.getAttribute('data-tested')
      if (t) expect(fs.existsSync(path.join(ROOT, t)), `file test "${t}" không tồn tại`).toBe(true) // prettier-ignore
      const v = await a11yViolations(container)
      expect(v, formatViolations(v)).toEqual([])
    })
  }
})
