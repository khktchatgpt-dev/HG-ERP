'use client'

import { Code, TextLink } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * SÁCH TRA — `TextLink` (28/09/2026). Tên bấm được, tách khỏi `Code` (mã chứng từ).
 */
export default function DocTextLink() {
  return (
    <CompDoc
      family="text-link"
      summary={
        <>
          Đường link cho <b>tên</b>: nhà cung cấp, người mua, khách hàng. Chữ thường màu
          hành động, gạch chân khi rê chuột. <code>Code</code> dành cho <b>mã</b> chứng từ
          (chữ đơn cách) — hai vai khác nhau, đừng đổi chỗ.
        </>
      }
      useWhen="tên một đối tượng dẫn tới hồ sơ / sổ của nó (NCC → hồ sơ NCC, người mua → sổ đơn của người đó)."
      avoidWhen={
        <>
          mã chứng từ / mã vật tư (dùng <code>Code as=&quot;a&quot;</code>); hành động
          (dùng <code>Btn</code>); link ra ngoài hệ thống (dùng thẻ a có{' '}
          <code>target</code>).
        </>
      }
      variants={[
        {
          name: 'Tên trong bảng',
          when: 'cột tên NCC / người mua.',
          demo: (
            <span className="text-k-body">
              <TextLink href="/mua-hang/ncc" title="CÔNG TY TNHH NHÔM TIẾN ĐẠT">
                Nhôm Tiến Đạt
              </TextLink>
            </span>
          ),
        },
        {
          name: 'strong — tên là thứ chính của dòng',
          when: 'cột đầu của bảng theo người.',
          demo: (
            <TextLink href="/mua-hang/don" strong>
              Truyền
            </TextLink>
          ),
        },
        {
          name: 'Cạnh mã chứng từ — để thấy hai vai',
          when: 'mã đi bằng Code, tên đi bằng TextLink.',
          demo: (
            <span className="text-k-body flex gap-3">
              <Code as="a" href="/mua-hang/don">
                PO-2026-0090
              </Code>
              <TextLink href="/mua-hang/ncc">Hiệp Hưng</TextLink>
            </span>
          ),
        },
      ]}
      states={[
        {
          state: 'Mặc định',
          looks: 'Chữ thường, màu hành động.',
          behaves: 'Bấm → next/link, không tải lại trang.',
        },
        { state: 'Rê chuột', looks: 'Gạch chân.', behaves: '—' },
        {
          state: 'Focus bàn phím',
          looks: 'Gạch chân (thay vòng focus).',
          behaves: 'Enter mở link.',
        },
      ]}
      a11y={{
        role: 'link',
        keys: [
          { key: 'Tab', does: 'Tới link.' },
          { key: 'Enter', does: 'Mở.' },
        ],
        reader: (
          <>
            Đọc tên + “link”. Tên rút gọn thì truyền <code>title</code> tên đầy đủ.
          </>
        ),
      }}
      doDont={[
        {
          do: 'Tên NCC / người bấm được đi bằng TextLink.',
          dont: 'Dùng Code as="a" cho tên — tên in bằng chữ máy chữ, trông thô.',
          source: 'soi ảnh chụp 1:1 màn Giám sát mua hàng, 28/09/2026',
        },
        {
          do: 'Tên rút gọn kèm title tên đầy đủ.',
          dont: 'Cắt tên mà không có đường đọc lại nguyên văn.',
          source: 'lib/po-list-labels supplierShortName',
        },
      ]}
      tested={{ file: 'src/components/kit/primitives.a11y.test.tsx' }}
    />
  )
}
