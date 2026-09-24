'use client'

import { useState } from 'react'
import { TextArea, TextInput } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

function QuyCach() {
  const [qc, setQc] = useState('20x40x1.2')
  const [lan, setLan] = useState(0)
  return (
    <div className="grid gap-2">
      <div className="w-[180px]">
        <TextInput
          mono
          label="Quy cách — VT-00123"
          value={qc}
          onCommit={(v) => {
            setQc(v)
            setLan((n) => n + 1)
          }}
        />
      </div>
      <span className="text-k-sm text-[var(--ink-2)]">
        Đã chốt: <b className="num">{qc}</b> · số lần onCommit:{' '}
        <b className="num">{lan}</b> — gõ rồi Enter hoặc rời ô; Esc trả chữ cũ.
      </span>
    </div>
  )
}

function SoPhieuNcc() {
  const [v, setV] = useState('')
  return (
    <div className="w-[260px]">
      <TextInput
        label="Số phiếu giao hàng của NCC"
        placeholder="VD: PGH-0931"
        value={v}
        onCommit={setV}
      />
    </div>
  )
}

function LyDo() {
  const [v, setV] = useState('')
  return (
    <div className="grid max-w-[460px] gap-1">
      <TextArea
        aria-label="Lý do trả lại đơn"
        placeholder="Nói rõ dòng nào sai và phải sửa gì, để người soạn không phải hỏi lại."
        value={v}
        onChange={setV}
      />
      <span className="text-k-label text-[var(--ink-3)]">
        <span className="num">{v.length}</span> ký tự
      </span>
    </div>
  )
}

function GhiChuTuNo() {
  const [v, setV] = useState('')
  return (
    <div className="max-w-[460px]">
      <TextArea
        aria-label="Ghi chú xử lý"
        placeholder="Gõ vài dòng — ô nở tới 6 dòng rồi mới cuộn."
        rows={2}
        maxRows={6}
        value={v}
        onChange={setV}
      />
    </div>
  )
}

export default function DocTextInput() {
  return (
    <CompDoc
      family="text-input"
      summary={
        <>
          <code>TextInput</code>: ô chữ một dòng, chốt khi rời ô hoặc Enter, Esc bỏ bản
          nháp — cùng luật với ô số, gõ dở không ghi. <code>TextArea</code>: ô nhiều dòng,
          kiểm soát MỖI PHÍM (gọi <code>onChange</code> liên tục), dành cho ghi chú và lý
          do.
        </>
      }
      useWhen="ô chữ tự do ở đầu đơn chế độ sửa, ô quy cách trong lưới (TextInput); ghi chú, lý do trả lại, lý do mở khoá (TextArea)."
      avoidWhen={
        <>
          chọn từ danh mục (dùng <code>Combobox</code>), gõ số (dùng <code>NumInput</code>
          ), gõ ngày (dùng <code>DateInput</code>), ô tìm trên thanh lọc (dùng{' '}
          <code>SearchInput</code>).
        </>
      }
      variants={[
        {
          name: 'TextInput mono — mã, quy cách',
          when: 'chữ phải thẳng cột với các dòng trên dưới. Thử gõ rồi Esc: chữ cũ trở lại, onCommit không chạy.',
          demo: <QuyCach />,
        },
        {
          name: 'TextInput thường, có placeholder',
          when: 'ô chữ ngắn ở đầu đơn. placeholder là gợi ý cách ghi, không thay tên ô.',
          demo: <SoPhieuNcc />,
        },
        {
          name: 'TextArea — lý do',
          when: 'câu dài 1–3 dòng. Không có maxRows thì ô cao cố định theo rows (mặc định 3); người dùng kéo góc để nới.',
          demo: <LyDo />,
        },
        {
          name: 'TextArea tự nở — maxRows',
          when: 'ghi chú lúc ngắn lúc dài. Ô nở theo chữ từ rows tới maxRows dòng rồi mới cuộn. Chắc ở Chrome/Edge 123+; trình duyệt chưa hiểu field-sizing thì đứng yên ở rows dòng.',
          demo: <GhiChuTuNo />,
        },
      ]}
      states={[
        {
          state: 'Mặc định',
          looks:
            'Viền mảnh, nền thẻ, cao bằng các điều khiển khác (TextArea cao theo rows; có maxRows thì cao theo chữ, trong khoảng rows–maxRows dòng).',
          behaves: 'TextInput hiện value đã chốt; TextArea hiện value.',
        },
        {
          state: 'Rê chuột',
          looks: 'Viền đậm lên.',
          behaves: '—',
        },
        {
          state: 'Focus',
          looks: 'Viền màu hành động + vòng 2px (khi đi bằng phím).',
          behaves: 'TextInput: gõ là sửa bản nháp. TextArea: mỗi phím gọi onChange.',
        },
        {
          state: 'Bị chặn',
          looks: 'Mờ 45%.',
          behaves:
            'disabled thật — không gõ được, rơi khỏi thứ tự Tab, không nói vì sao.',
        },
      ]}
      a11y={{
        role: 'textbox (TextArea: textbox nhiều dòng)',
        keys: [
          {
            key: 'Enter',
            does: 'TextInput: chốt — ô mất tiêu điểm (blur). TextArea: xuống dòng.',
          },
          {
            key: 'Esc',
            does: 'TextInput: bỏ bản nháp, trả chữ đã chốt; con trỏ ở lại ô.',
          },
          { key: 'Tab', does: 'Rời ô — TextInput chốt nếu chữ đã khác.' },
        ],
        reader: (
          <>
            Đọc tên ô rồi nội dung. <b>Ghi thật:</b> <code>label</code> của TextInput
            không bắt buộc, còn TextArea không có prop tên — ô trong lưới phải tự truyền
            tên (<code>label</code> / <code>aria-label</code>), không thì ô câm. Enter
            trên TextInput làm ô MẤT tiêu điểm chứ không đi sang ô kế — lưới muốn đi ô thì
            tự bắt Enter (xem dưới). Chưa có trạng thái lỗi hay gợi ý nối bằng{' '}
            <code>aria-describedby</code>. Prop của chỗ gọi được GHÉP, không ĐÈ (sửa
            24/09/2026, B7½): <code>onKeyDown</code> của TextInput chạy TRƯỚC, Enter/Esc
            vẫn chạy — trừ khi chỗ gọi đã <code>preventDefault</code> phím đó thì ô nhường
            phím; <code>className</code> cộng vào kiểu của ô ở cả hai. TextInput không
            nhận <code>onBlur</code> (kiểu đã bỏ) — rời ô là chốt, việc cần làm lúc chốt
            đặt ở <code>onCommit</code>.
          </>
        ),
      }}
      doDont={[
        {
          do: 'TextInput chốt khi rời ô — ghi vào dữ liệu ở onCommit.',
          dont: 'Gọi API mỗi phím — gõ dở cũng thành dữ liệu.',
          source:
            'JSDoc của TextInput (kit/Primitives.tsx) — “cùng luật với ô số: gõ dở không ghi”',
        },
        {
          do: (
            <>
              <code>mono</code> cho mã, quy cách, kích thước.
            </>
          ),
          dont: 'Chữ thường cho “1200x600x18” — cột nhấp nhô, khó so hai dòng.',
          source: 'JSDoc của prop mono (kit/Primitives.tsx)',
        },
        {
          do: (
            <>
              TextArea cho ghi chú lúc ngắn lúc dài: <code>rows</code> là sàn,{' '}
              <code>maxRows</code> là trần — ô tự nở bằng CSS <code>field-sizing</code>.
            </>
          ),
          dont: (
            <>
              Đo <code>scrollHeight</code> bằng JS mỗi phím — giật một nhịp, và đo sai khi
              ô đang ẩn trong khay đóng.
            </>
          ),
          source:
            'chú thích TextArea (kit/Primitives.tsx) — maxRows làm thật từ B7½, 24/09/2026',
        },
        {
          do: (
            <>
              Lưới tự đi ô: bắt Enter ở <code>onKeyDown</code> rồi{' '}
              <code>preventDefault</code> — ô nhường phím, rời ô vẫn chốt.
            </>
          ),
          dont: 'Tự dựng một ô chữ riêng cho lưới chỉ để giành Enter — mất luôn luật chốt khi rời ô và Esc bỏ nháp của kit.',
          source:
            'test “chỗ gọi preventDefault một phím thì ô NHƯỜNG phím đó” (primitives.a11y.test.tsx)',
        },
        {
          do: 'Dùng TextInput / TextArea của kit.',
          dont: 'Thẻ input / textarea thô.',
          source: 'luật lint hg/no-raw-control (eslint-rules/hg-ui.mjs)',
        },
      ]}
      tested={{ file: 'src/components/kit/primitives.a11y.test.tsx' }}
    />
  )
}
