import type { ReactNode } from 'react'

/**
 * Mảnh dựng của TÀI LIỆU (không phải của sản phẩm).
 *
 * Tách khỏi `@/components/kit` có chủ ý: kit chỉ được chứa thứ màn nghiệp vụ
 * dùng. Nhét mấy khối "mục có số", "khối demo" vào kit thì kit phình lên vì
 * nhu cầu của trang nói về chính nó, và người làm màn thật sẽ tưởng đó là
 * thành phần được phép dùng.
 */

export function Doc({ children }: { children: ReactNode }) {
  return <div className="lab-doc">{children}</div>
}

export function Hero({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: string
  children?: ReactNode
}) {
  return (
    <header className="lab-hero">
      <div className="lab-eyebrow">{eyebrow}</div>
      <h1 className="lab-title">{title}</h1>
      {children}
    </header>
  )
}

/** Mục có số. `id` để CLAUDE.md và review trỏ tới được bằng neo cố định. */
export function Sec({
  n,
  id,
  title,
  why,
  children,
}: {
  n: number | string
  id?: string
  title: string
  why: ReactNode
  children: ReactNode
}) {
  return (
    <section className="lab-sec" id={id}>
      <div className="lab-h">
        <span className="lab-n num">
          {typeof n === 'number' ? String(n).padStart(2, '0') : n}
        </span>
        <div>
          <h2 className="lab-t">{title}</h2>
          <p className="lab-w">{why}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

/**
 * Một nguyên tắc.
 *
 * `symptom` KHÔNG optional, có chủ ý — cùng lý do với `Empty` của kit: nguyên
 * tắc không nói được "hỏng thì thấy gì" là nguyên tắc không kiểm được, và
 * kiểu bắt buộc là cách rẻ nhất để không ai viết được một cái như vậy.
 */
export function Rule({
  n,
  title,
  children,
  symptom,
}: {
  n: number
  title: string
  children: ReactNode
  symptom: ReactNode
}) {
  return (
    <article className="lab-rule">
      <div className="lab-rule-n">{String(n).padStart(2, '0')}</div>
      <div>
        <h3>{title}</h3>
        <p>{children}</p>
        <p className="lab-symptom">
          <b>Hỏng thì thấy gì:</b> {symptom}
        </p>
      </div>
    </article>
  )
}

/** Chú thích của SỔ, đặt bên trong màn mẫu. Phải nhìn ra ngay là lời tài liệu. */
export function LabNote({ children }: { children: ReactNode }) {
  return <div className="lab-note">{children}</div>
}
