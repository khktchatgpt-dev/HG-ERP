import type { ReactNode } from 'react'
import { Doc, Hero, Sec } from './Doc'
import { familyOf } from './kit-families'
import kitApi from './kit-api.json'

/**
 * KHUÔN TRANG TÀI LIỆU cho MỘT thành phần kit — bước B0 của kế hoạch hệ thiết
 * kế (docs/he-thiet-ke-erp-ke-hoach.md §6).
 *
 * VÌ SAO CẦN. Rà 24/09/2026: `/design-lab/thanh-phan` có 11 mục cho ~95 thành
 * phần, 0 bảng thuộc tính, 0 mục nên/đừng. Nó là TỦ TRƯNG BÀY (hiểu khi nào
 * dùng), chưa phải SÁCH TRA (biết prop nào có, phím nào chạy) — nên người dựng
 * màn phải mở mã nguồn kit ra đọc.
 *
 * SÁU MỤC, CẢ SÁU BẮT BUỘC — theo khuôn "blueprint" của Salesforce Lightning.
 * Bắt buộc ở tầng KIỂU, cùng thủ pháp với `symptom` của `Rule` và `reason` của
 * `Empty`: thiếu mục nào là TypeScript báo lỗi, nên không ai viết được một
 * trang tài liệu nửa vời.
 *
 * `tested` cũng bắt buộc, và KHÔNG được bỏ trống câm: hoặc trỏ tới file test
 * dựng + truy cập, hoặc nói thẳng VÌ SAO chưa có. Lời khẳng định về truy cập
 * mà không có test đứng sau là lời hứa không ai giữ — đúng chuyện `Sheet` khai
 * `aria-modal` mà không giữ focus.
 *
 * B7 (24/09/2026): trang theo HỌ (`kit-families.ts`), và mục 3 KHÔNG còn viết
 * tay — bảng thuộc tính sinh từ `kit-api.json` (scripts/kit-api-lib.mjs). Bảng
 * viết tay là thứ lệch mã nhanh nhất; nghĩa từng prop nay nằm ở JSDoc ngay cạnh
 * khai báo, nơi người sửa prop nhìn thấy.
 */

export type CompVariant = { name: string; when: string; demo: ReactNode }
export type CompState = { state: string; looks: string; behaves: string }
export type CompKey = { key: string; does: string }
export type CompDoDont = {
  do: ReactNode
  dont: ReactNode
  /** Lỗi thật đã dính sinh ra luật này — nên/đừng không có nguồn là lời khuyên suông. */
  source?: string
}

type ApiProp = {
  name: string
  type: string
  optional: boolean
  def: string | null
  doc: string
}
type ApiEntry = { file: string; props: ApiProp[]; extends: string[] }
const API = kitApi as Record<string, ApiEntry>

/** JSDoc viết tên mã trong dấu backtick — bày thành chữ mã, như trong IDE. */
function CodeSpans({ text }: { text: string }) {
  return text.split('`').map((s, i) => (i % 2 ? <code key={i}>{s}</code> : s))
}

export function CompDoc({
  family,
  alsoImport = [],
  summary,
  useWhen,
  avoidWhen,
  variants,
  states,
  a11y,
  doDont,
  tested,
}: {
  /** `slug` trong `kit-families.ts` — tên, thành viên, dòng import đều lấy từ đó. */
  family: string
  /** Hàm/hằng đi kèm họ (`useKitTable`, `useToast`) — thêm vào dòng import. */
  alsoImport?: string[]
  summary: ReactNode
  /** Mục 1 — một câu mỗi vế. */
  useWhen: ReactNode
  avoidWhen: ReactNode
  /** Mục 2 — ít nhất một, mỗi biến thể một ví dụ SỐNG (không phải ảnh chụp). */
  variants: [CompVariant, ...CompVariant[]]
  /** Mục 4 */
  states: [CompState, ...CompState[]]
  /** Mục 5 */
  a11y: { role: string; keys: CompKey[]; reader: ReactNode }
  /** Mục 6 */
  doDont: [CompDoDont, ...CompDoDont[]]
  tested: { file: string } | { missing: string }
}) {
  const fam = familyOf(family)
  if (!fam) throw new Error(`CompDoc: họ "${family}" không có trong kit-families.ts`)
  const files = [...new Set(fam.members.map((m) => API[m]?.file).filter(Boolean))]
  return (
    <Doc>
      <Hero eyebrow={`Thành phần · ${fam.group}`} title={fam.title}>
        <p className="lab-w">{summary}</p>
        <p className="lab-w">
          <code>
            {`import { ${[...fam.members, ...alsoImport].join(', ')} } from '@/components/kit'`}
          </code>
        </p>
        <p className="lab-w">
          Mã nguồn:{' '}
          {files.map((f, i) => (
            <span key={f}>
              {i > 0 && ' · '}
              <code>{f}</code>
            </span>
          ))}
        </p>
        <p className="lab-w">
          {'file' in tested ? (
            <>
              Truy cập đã kiểm bằng test:{' '}
              <code data-tested={tested.file}>{tested.file}</code>
            </>
          ) : (
            <>
              <b>Chưa có test truy cập</b> — {tested.missing}
            </>
          )}
        </p>
      </Hero>

      <Sec n={1} id="khi-nao" title="Dùng khi nào" why="Một câu mỗi vế.">
        <div className="lab-demo">
          <p>
            <b>Dùng khi</b> {useWhen}
          </p>
          <p>
            <b>Đừng dùng khi</b> {avoidWhen}
          </p>
        </div>
      </Sec>

      <Sec
        n={2}
        id="bien-the"
        title="Biến thể"
        why="Mỗi biến thể một ví dụ sống, dựng bằng chính thành phần thật."
      >
        {variants.map((v) => (
          <div key={v.name} className="lab-demo">
            <p>
              <b>{v.name}</b> — {v.when}
            </p>
            <div className="kit">{v.demo}</div>
          </div>
        ))}
      </Sec>

      <Sec
        n={3}
        id="thuoc-tinh"
        title="Thuộc tính"
        why={
          <>
            Sinh từ kiểu TypeScript + chú thích JSDoc trong mã kit (
            <code>npm run kit:api</code>) — không viết tay, nên không lệch mã. Sửa nghĩa
            thì sửa chú thích ở mã nguồn.
          </>
        }
      >
        {fam.members.map((m) => {
          const api = API[m]
          if (!api) throw new Error(`CompDoc: "${m}" không có trong kit-api.json`)
          return (
            <div key={m} className="lab-demo">
              {fam.members.length > 1 && (
                <p>
                  <b>
                    <code>{m}</code>
                  </b>
                </p>
              )}
              {api.props.length === 0 ? (
                <p>Không nhận thuộc tính nào.</p>
              ) : (
                <table className="lab-tbl">
                  <thead>
                    <tr>
                      <th>Tên</th>
                      <th>Kiểu</th>
                      <th>Mặc định</th>
                      <th>Nghĩa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {api.props.map((p) => (
                      <tr key={p.name}>
                        <td>
                          <code>{p.name}</code>
                        </td>
                        <td>
                          <code>{p.type}</code>
                        </td>
                        <td>
                          {!p.optional ? (
                            <b>bắt buộc</b>
                          ) : p.def ? (
                            <code>{p.def}</code>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          {p.doc ? <CodeSpans text={p.doc} /> : <i>chưa ghi nghĩa</i>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {api.extends.length > 0 && (
                <p>
                  Nhận thêm mọi thuộc tính của{' '}
                  {api.extends.map((x, i) => (
                    <span key={x}>
                      {i > 0 && ', '}
                      <code>{x}</code>
                    </span>
                  ))}{' '}
                  — chuyển thẳng xuống phần tử gốc.
                </p>
              )}
            </div>
          )
        })}
      </Sec>

      <Sec n={4} id="trang-thai" title="Trạng thái" why="Trông ra sao, và làm gì.">
        <div className="lab-demo">
          <table className="lab-tbl">
            <thead>
              <tr>
                <th>Trạng thái</th>
                <th>Trông ra sao</th>
                <th>Hành vi</th>
              </tr>
            </thead>
            <tbody>
              {states.map((s) => (
                <tr key={s.state}>
                  <td>
                    <b>{s.state}</b>
                  </td>
                  <td>{s.looks}</td>
                  <td>{s.behaves}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Sec>

      <Sec
        n={5}
        id="truy-cap"
        title="Truy cập"
        why="Vai trò ARIA, phím, và trình đọc màn hình đọc ra gì."
      >
        <div className="lab-demo">
          <p>
            <b>Vai trò:</b> <code>{a11y.role}</code>
          </p>
          {a11y.keys.length > 0 && (
            <table className="lab-tbl">
              <thead>
                <tr>
                  <th>Phím</th>
                  <th>Làm gì</th>
                </tr>
              </thead>
              <tbody>
                {a11y.keys.map((k) => (
                  <tr key={k.key}>
                    <td>
                      <kbd>{k.key}</kbd>
                    </td>
                    <td>{k.does}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p>
            <b>Trình đọc màn hình:</b> {a11y.reader}
          </p>
        </div>
      </Sec>

      <Sec
        n={6}
        id="nen-dung"
        title="Nên / đừng"
        why="Rút từ lỗi đã dính thật trong dự án, không phải lời khuyên chung."
      >
        <div className="lab-demo">
          <table className="lab-tbl">
            <thead>
              <tr>
                <th>✅ Nên</th>
                <th>❌ Đừng</th>
              </tr>
            </thead>
            <tbody>
              {doDont.map((d, i) => (
                <tr key={i}>
                  <td>{d.do}</td>
                  <td>
                    {d.dont}
                    {d.source && <div className="lab-src">Nguồn: {d.source}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Sec>
    </Doc>
  )
}
