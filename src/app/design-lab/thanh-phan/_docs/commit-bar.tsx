'use client'

import { useState } from 'react'
import { Btn, CommitBar } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * TRANG TÀI LIỆU — thanh chốt đáy màn nhập liệu (B7, 24/09/2026).
 *
 * Ví dụ một có `onGoBlocked` thật: bấm câu chặn thì báo nó sẽ nhảy tới đâu.
 * Màn thật cuộn tới đúng ô và đặt con trỏ vào đó (xem `nhayToi` ở
 * `PhieuNhapScreen`); ở đây không có lưới nên chỉ bày câu báo.
 *
 * B7 ghi ba lỗi của câu chặn (nút chết khi thiếu `onGoBlocked`, đổi câu mà trình
 * đọc không báo, mũi tên → lọt vào tên nút); cả ba đã sửa ở B7½ (24/09/2026) —
 * mục 4–5 tả hành vi sau khi sửa, ví dụ ba bày nhánh "chỉ là chữ".
 */
function BiChan() {
  const [coGia, setCoGia] = useState(false)
  const [toi, setToi] = useState(false)
  const blocked = coGia ? undefined : 'dòng 3 (VT-ONG-2525) chưa có đơn giá'
  return (
    <div>
      <CommitBar
        totals={[
          { label: 'Tiền hàng', value: coGia ? '45.000.000 ₫' : '38.280.000 ₫' },
          { label: 'VAT 8%', value: coGia ? '3.600.000 ₫' : '3.062.400 ₫' },
        ]}
        grand={{
          label: 'Tổng thanh toán',
          value: coGia ? '48.600.000 ₫' : '41.342.400 ₫',
        }}
        blocked={blocked}
        onGoBlocked={() => setToi(true)}
        actions={
          <Btn icon="luuNhap" primary disabled={!!blocked}>
            Lưu nháp
          </Btn>
        }
      />
      <p className="text-k-sm m-0 flex items-center gap-2 px-3 py-1.5 text-[var(--ink-3)]">
        <span aria-live="polite">
          {coGia
            ? 'Đã có giá — lưu được.'
            : toi
              ? 'Màn thật cuộn tới ô Đơn giá của dòng 3 và đặt con trỏ vào đó.'
              : 'Bấm câu “Chưa lưu được” để thử.'}
        </span>
        <Btn
          icon={coGia ? 'xoa' : 'sua'}
          onClick={() => {
            setCoGia(!coGia)
            setToi(false)
          }}
        >
          {coGia ? 'Xoá giá dòng 3' : 'Điền giá dòng 3'}
        </Btn>
      </p>
    </div>
  )
}

export default function DocCommitBar() {
  return (
    <CompDoc
      family="commit-bar"
      summary={
        <>
          Thanh chốt dưới đáy màn nhập liệu: tổng của chứng từ, câu nói{' '}
          <b>vì sao chưa lưu được</b>, và nút lưu. Có <code>onGoBlocked</code> thì câu
          chặn là một nút — bấm vào thì nhảy tới đúng ô phải sửa; không có thì nó chỉ là
          chữ.
        </>
      }
      useWhen={
        <>
          Khuôn F — người đang gõ dòng thứ 38 vẫn phải thấy tổng tiền và thấy vì sao chưa
          lưu được. Đặt làm con cuối của <code>ScreenFrame</code> để nó nằm dưới bảng
          cuộn.
        </>
      }
      avoidWhen={
        <>
          màn đọc chứng từ (Khuôn D) — hành động ở <code>ActionPane</code> góc trên phải
          (AGENTS.md cấm thanh hành động nổi dính đáy đơn độc); và vỏ chương trình (ai
          đang đăng nhập, bản ghi thứ mấy) — dùng <code>StatusBar</code>.
        </>
      }
      variants={[
        {
          name: 'Chưa lưu được — câu chặn bấm được',
          when: 'một dòng thiếu giá. Tổng vẫn hiện, nút lưu khoá, câu chặn dẫn tới đúng dòng.',
          demo: <BiChan />,
        },
        {
          name: 'Lưu được',
          when: 'không có blocked: không có câu chặn, chỉ còn tổng và nút.',
          demo: (
            <CommitBar
              totals={[
                { label: 'Dòng chọn', value: '12/12' },
                { label: 'Tiền hàng', value: '45.000.000 ₫' },
              ]}
              grand={{ label: 'Tổng thanh toán', value: '48.600.000 ₫' }}
              actions={
                <>
                  <Btn icon="in">Xem trước phiếu in</Btn>
                  <Btn icon="luuNhap" primary>
                    Lưu nháp
                  </Btn>
                </>
              }
            />
          ),
        },
        {
          name: 'Chưa lưu được — không chỉ ra được ô',
          when: 'màn không biết ô nào phải sửa (lỗi gộp của cả phiếu). Không truyền onGoBlocked: câu chặn là CHỮ trong viên cam, không giả làm nút. Hiếm — hầu hết lỗi chặn đều chỉ ra được ô.',
          demo: (
            <CommitBar
              totals={[{ label: 'Tiền hàng', value: '45.000.000 ₫' }]}
              grand={{ label: 'Tổng thanh toán', value: '48.600.000 ₫' }}
              blocked="tổng gõ tay lệch tổng các dòng 12.000 ₫"
              actions={
                <Btn icon="luuNhap" primary disabled>
                  Lưu nháp
                </Btn>
              }
            />
          ),
        },
      ]}
      states={[
        {
          state: 'Lưu được (blocked trống)',
          looks:
            'Hàng ngang nền thẻ, vạch trên; tổng phụ chữ mono bên trái, tổng chính số lớn đẩy sát phải, rồi các nút.',
          behaves: 'Tĩnh; mọi tương tác nằm ở nút của actions.',
        },
        {
          state: 'Chưa lưu được (có blocked)',
          looks:
            'Thêm viên cam (--warn-wash, viền --warn-line): "Chưa lưu được: … →", đứng trước tổng chính.',
          behaves:
            'Có onGoBlocked: viên là nút, bấm gọi onGoBlocked. Không có: viên là chữ, không có mũi tên, không nhận Tab (sửa 24/09/2026, B7½ — trước đó vẫn ra một nút chết). Kit KHÔNG tự khoá nút lưu trong actions — chỗ gọi tự khoá.',
        },
        {
          state: 'Câu chặn đổi / xuất hiện / biến mất',
          looks: 'Chỉ viên đổi chữ; phần còn lại của thanh đứng yên.',
          behaves:
            'Viên nằm trong vùng role="status" LUÔN có mặt (rỗng khi lưu được), nên trình đọc báo câu mới mà không cần focus. Sửa 24/09/2026 (B7½).',
        },
        {
          state: 'Vị trí',
          looks: 'Nằm dưới cùng khi là con cuối của ScreenFrame.',
          behaves:
            'Bản thân thanh không có position: sticky — nó ở đáy vì bảng phía trên tự cuộn trong khung.',
        },
      ]}
      a11y={{
        role: 'div; câu chặn nằm trong vùng status — là button khi có onGoBlocked, chữ khi không',
        keys: [
          {
            key: 'Tab',
            does: 'Tới câu chặn (khi có và có onGoBlocked), rồi các nút của actions.',
          },
          { key: 'Enter / Space', does: 'Trên câu chặn: gọi onGoBlocked.' },
        ],
        reader: (
          <>
            Câu chặn là nút thì tên đúng bằng câu: &quot;Chưa lưu được: dòng 3 … chưa có
            đơn giá, nút&quot; — mũi tên → mang <code>aria-hidden</code> nên không lọt vào
            tên. Câu nằm trong vùng <code>role=&quot;status&quot;</code> dựng sẵn từ đầu,
            nên khi câu đổi (sửa xong NCC, câu chuyển sang &quot;dòng 3 thiếu đơn
            giá&quot;) hay hết chặn, trình đọc báo mà người nghe không phải dò lại. Thiếu{' '}
            <code>onGoBlocked</code> thì câu chỉ là chữ, không giả làm nút. Cả ba sửa
            24/09/2026 (B7½), test ở <code>erp.a11y.test.tsx</code>.{' '}
            <b>Chưa thử bằng trình đọc thật, ghi thật:</b> hết chặn thì vùng status chỉ
            rỗng đi — có trình đọc im lặng khi vùng live bị xoá chữ, nên người nghe có thể
            không được báo &quot;đã lưu được&quot;.
          </>
        ),
      }}
      doDont={[
        {
          do: (
            <>
              Luôn truyền <code>onGoBlocked</code> nhảy tới đúng ô phải sửa khi có{' '}
              <code>blocked</code>.
            </>
          ),
          dont: 'Để câu chặn không dẫn đi đâu — người dùng tự dò 40 dòng, chỗ hỏng còn nằm ngoài màn khi bảng cuộn ngang.',
          source:
            'CLAUDE.md khuôn F — "phải nói vì sao chưa lưu được bằng một câu bấm được"; Erp.tsx docstring CommitBar; NhapHoaDonScreen.tsx (goBlocked, B7½ 24/09/2026) — màn này từng vẽ câu chặn thành nút chết',
        },
        {
          do: 'Viết blocked chỉ ra CHỖ: "dòng 3 (VT-ONG-2525) chưa có đơn giá".',
          dont: 'Viết "Dữ liệu chưa hợp lệ".',
          source:
            'CLAUDE.md luật kiểm — "Hành động bị chặn phải nói vướng gì và cách gỡ, ngay tại chỗ"',
        },
        {
          do: 'Khoá nút lưu theo cùng điều kiện với blocked.',
          dont: 'Cho bấm Lưu rồi mới báo lỗi.',
          source: 'CLAUDE.md luật kiểm — "Không cho bấm rồi mới báo lỗi"',
        },
      ]}
      tested={{ file: 'src/components/kit/erp.a11y.test.tsx' }}
    />
  )
}
