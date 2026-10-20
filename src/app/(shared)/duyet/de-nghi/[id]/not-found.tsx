import Link from 'next/link'

/**
 * Phiếu đề nghị không còn — mở từ thông báo cũ / đường dẫn chép trên Zalo của
 * một phiếu đã bị xoá, hoặc gõ sai đường dẫn. Trang 404 mặc định của Next ("This
 * page could not be found") không nói gì; người duyệt cần biết vì sao và đi đâu
 * tiếp (gặp thật 14/10/2026: bấm vào phiếu thử vừa bị dọn).
 */
export default function DeNghiKhongCon() {
  return (
    <div className="mx-auto flex max-w-[640px] flex-col gap-3 px-4 py-12 text-center">
      <h1 className="m-0 text-[18px] font-semibold">Không tìm thấy phiếu đề nghị này</h1>
      <p className="m-0 text-[13px] text-[var(--muted-foreground)]">
        Phiếu có thể đã bị xoá, hoặc đường dẫn không đúng (thông báo cũ, đường dẫn chép
        sai).
      </p>
      <div className="flex flex-wrap justify-center gap-2 text-[13px]">
        <Link
          href="/duyet/de-nghi"
          className="rounded-[4px] bg-[var(--primary)] px-3 py-1.5 font-semibold text-white"
        >
          Về danh sách đề nghị mua
        </Link>
      </div>
    </div>
  )
}
