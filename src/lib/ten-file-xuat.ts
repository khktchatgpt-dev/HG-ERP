/**
 * TÊN FILE XUẤT đọc được bằng mắt (user 27/10/2026: "tên file xuất đặt cho hợp lý" — trước đó
 * "Cả công ty kỳ 10-2026.xlsx" không nói là file gì, chị đổi tay thành "26-25 TH.xlsx").
 * Mẫu: `<Loại> - <Nhóm> - 26.09-25.10.2026.xlsx`. Dấu chấm thay gạch chéo vì tên file cấm `/`.
 * Tên có dấu tiếng Việt an toàn: `xlsxResponse` gửi kèm `filename*` UTF-8.
 */

const dm = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`

/** '2026-09-26', '2026-10-25' → '26.09-25.10.2026'; khác năm → '26.12.2025-25.01.2026'. */
export function khoangNgayTenFile(tu: string, den: string): string {
  return tu.slice(0, 4) === den.slice(0, 4)
    ? `${dm(tu)}-${dm(den)}.${den.slice(0, 4)}`
    : `${dm(tu)}.${tu.slice(0, 4)}-${dm(den)}.${den.slice(0, 4)}`
}

/** Ghép các phần bằng " - ", bỏ ký tự tên file cấm, thêm đuôi .xlsx. */
export function tenFileXuat(...phan: (string | null | undefined)[]): string {
  const sach = phan
    .filter((p): p is string => !!p && !!p.trim())
    .map((p) =>
      p
        .replace(/[\\/:*?"<>|]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
  return `${sach.join(' - ')}.xlsx`
}
