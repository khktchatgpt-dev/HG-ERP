'use client'

import { useState } from 'react'
import { Crumb } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * SÁCH TRA `Crumb` — thanh định vị đầu màn chứng từ (B7, 24/09/2026).
 *
 * B7 ghi ba chỗ yếu: dải không phải landmark `nav`, dấu › được đọc thành
 * tiếng, và mảnh cuối không mang `aria-current`. Cả ba đã sửa ở kit (B7½,
 * 24/09/2026); mục 5 tả hành vi sau khi sửa. Ba ví dụ dưới đây mỗi cái một
 * `label` riêng — ba mốc `nav` trùng tên trên một trang là lỗi `landmark-unique`.
 */

const TAP = ['PO-2609-012', 'PO-2609-013', 'PO-2609-014', 'PO-2609-015', 'PO-2609-016']

function LatTo() {
  const [i, setI] = useState(2)
  return (
    <Crumb
      label="Đường dẫn — ví dụ lật tờ"
      path={[{ label: 'Đơn mua', href: '/design-lab/mau-danh-sach' }, TAP[i]]}
      position={[i + 1, TAP.length]}
      onPrev={() => setI((v) => Math.max(0, v - 1))}
      onNext={() => setI((v) => Math.min(TAP.length - 1, v + 1))}
    />
  )
}

export default function DocCrumb() {
  return (
    <CompDoc
      family="crumb"
      summary={
        <>
          Thanh định vị: <i>module › danh sách › chứng từ</i>, kèm <b>khung nhìn</b> đang
          chọn và nút <b>lật tờ</b> ‹ 14 / 68 › để đi hết tập chứng từ đang lọc mà không
          quay ra danh sách. Mảnh có <code>href</code> thì bấm được; mảnh cuối là trang
          hiện tại, không bao giờ là link.
        </>
      }
      useWhen="dòng đầu tiên của mọi màn chứng từ (Khuôn D) — nơi người dùng bấm để quay ra danh sách, và lật sang tờ kế."
      avoidWhen={
        <>
          màn danh sách, bàn làm việc — ở đó tiêu đề trang đã đủ, dùng{' '}
          <code>ScreenHeader</code> của khuôn tương ứng. Đừng dùng <code>Crumb</code> làm
          menu điều hướng giữa các phân hệ: đó là việc của thanh bên.
        </>
      }
      variants={[
        {
          name: 'Có đường quay ra + lật tờ',
          when: 'màn chứng từ mở từ một danh sách đã lọc. Bấm ‹ › để lật; mảnh “Đơn mua” là link về danh sách.',
          demo: <LatTo />,
        },
        {
          name: 'Kèm khung nhìn đã lưu',
          when: 'danh sách có khung nhìn (“Đơn của tôi · quá hạn”) — nhắc người dùng đang lật trong tập NÀO.',
          demo: (
            <Crumb
              label="Đường dẫn — ví dụ khung nhìn"
              path={['Cung ứng', { label: 'Đơn đặt vật tư', href: '/design-lab/mau-danh-sach' }, 'PO-2609-014']}
              view="Đơn của tôi · quá hạn"
              onView={() => {}}
              position={[14, 68]}
            />
          ), // prettier-ignore
        },
        {
          name: 'Chuỗi trần — chỉ để nhận diện',
          when: 'các mảnh không có trang để quay về. Vẫn nhận string[] để chỗ gọi cũ không phải sửa.',
          demo: (
            <Crumb
              label="Đường dẫn — ví dụ chuỗi trần"
              path={['Sản xuất', 'Lệnh sản xuất', '06/26-27 - MX']}
            />
          ),
        },
      ]}
      states={[
        {
          state: 'Mặc định',
          looks:
            'Dải nền chrome, chữ nhỏ; mảnh đầu (module) chữ nhạt, mảnh cuối đậm; ngăn bằng ›.',
          behaves:
            'Mảnh có href là liên kết next/link — quay ra danh sách giữ được bộ lọc.',
        },
        {
          state: 'Rê chuột trên mảnh link',
          looks: 'Chữ màu hành động + gạch chân.',
          behaves: 'Mảnh không có href không đổi gì khi rê.',
        },
        {
          state: 'Focus',
          looks:
            'Vòng 2px màu hành động quanh link / nút (quy tắc chung :focus-visible của .kit).',
          behaves: 'Chỉ khi đi bằng bàn phím.',
        },
        {
          state: 'Không có onPrev / onNext',
          looks: 'Nút ‹ › vẫn hiện y như thường.',
          behaves:
            'Bấm không làm gì. Kit không tự khoá nút ở tờ đầu / tờ cuối — trang phải tự lo.',
        },
      ]}
      a11y={{
        role: 'navigation (<nav aria-label>, mặc định “Đường dẫn”); link là <a>, lật tờ là <button>',
        keys: [
          { key: 'Tab', does: 'Đi qua các mảnh link, nút khung nhìn, nút ‹ và ›.' },
          { key: 'Enter', does: 'Theo link / bấm nút.' },
        ],
        reader: (
          <>
            Dải là landmark <code>&lt;nav&gt;</code> có tên (prop <code>label</code>, mặc
            định “Đường dẫn”) nên nhảy tới được bằng phím mốc; dấu › mang{' '}
            <code>aria-hidden</code> nên không bị đọc thành tiếng giữa các mảnh; mảnh cuối
            mang <code>aria-current=&quot;page&quot;</code>. Cả ba sửa 24/09/2026 (B7½),
            test ở <code>erp.a11y.test.tsx</code>. Nút lật tờ có tên (“Chứng từ trước”,
            “Chứng từ sau”), số “14 / 68” đọc như chữ. <b>Còn chưa tốt, ghi thật:</b> nút
            khung nhìn mở menu nhưng không khai <code>aria-haspopup</code>; và nút ‹ ›
            không có <code>onPrev</code>/<code>onNext</code> vẫn nhận Tab mà bấm không làm
            gì.
          </>
        ),
      }}
      doDont={[
        {
          do: (
            <>
              Truyền <code>{'{ label, href }'}</code> cho mảnh danh sách để bấm quay ra
              được.
            </>
          ),
          dont: 'Một dải trông y hệt breadcrumb mà không mảnh nào đi đâu được.',
          source:
            'commit 2b5c51a (14/09/2026) — chủ dự án báo “Đơn mua › PO-2026-0067, phần này không hoạt động để quay lại trang”',
        },
        {
          do: 'Lật tờ trong ĐÚNG tập đang lọc ở danh sách, kèm vị trí n / N.',
          dont: 'Bắt người dùng quay ra danh sách rồi mở tờ kế — mất bộ lọc, mất chỗ đang đọc.',
          source:
            'chú thích mục 1 trong kit/Erp.tsx (điều hướng bản ghi của SAP / Dynamics)',
        },
        {
          do: (
            <>
              Màn thật để <code>label</code> mặc định; trang bày nhiều <code>Crumb</code>{' '}
              thì đặt mỗi cái một <code>label</code> khác nhau.
            </>
          ),
          dont: 'Hai dải cùng tên “Đường dẫn” trên một trang — người dùng phím mốc không phân biệt được.',
          source:
            'JSDoc prop label, kit/Erp.tsx (B7½, 24/09/2026) — axe landmark-unique trên chính trang này',
        },
      ]}
      tested={{ file: 'src/components/kit/erp.a11y.test.tsx' }}
    />
  )
}
