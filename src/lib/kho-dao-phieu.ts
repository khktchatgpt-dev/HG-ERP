/**
 * ĐẢO PHIẾU KHO — luật CHẶN, tách thuần khỏi service để màn bày được lý do.
 *
 * VÌ SAO TÁCH. `stockService.reverseDoc` đã có đủ sáu chốt chặn, nhưng chúng
 * chỉ lên tiếng SAU khi người dùng bấm. Luật kiểm của `/design-lab` bắt ngược
 * lại: hành động bị chặn phải nói vướng gì VÀ cách gỡ, ngay tại chỗ. Muốn vậy
 * màn phải biết luật trước khi vẽ nút — nên luật ra đây, cả hai bên cùng gọi.
 *
 * MỘT CHỐT KHÔNG THỂ RA ĐÂY: đảo phiếu nhập là xuất hàng ngược ra, nên còn
 * phải đủ tồn. Cái đó phụ thuộc tồn hiện tại nên chỉ server trả lời được, và
 * `reverseDoc` vẫn là hàng rào cuối. `canDao` trả `true` nghĩa là "không
 * vướng luật nào ĐỌC ĐƯỢC TỪ TỜ PHIẾU", không phải "chắc chắn đảo xong".
 */

export type TinhTrangPhieu = {
  kind: 'receipt' | 'issue' | 'transfer' | 'stocktake'
  status: 'pending' | 'posted' | 'rejected'
  /** Tờ này CHÍNH LÀ một phiếu đảo. */
  laPhieuDao: boolean
  /** Mã phiếu đã đảo tờ này, nếu có. */
  daBiDaoBoi: string | null
  /** Có dòng hàng QC loại — đường đảo tự động không xử được. */
  coHangLoai: boolean
  soDong: number
}

export type KetQuaDao =
  { duoc: true; canhBao: string | null } | { duoc: false; vuong: string; goBang: string }

/**
 * Thứ tự kiểm là CÓ Ý: nói cái chặn CỨNG NHẤT trước. Người cầm một biên bản
 * kiểm kê cần nghe "kiểm kê có vòng duyệt riêng", không cần nghe "phiếu này
 * đã bị đảo rồi" — hai câu đúng cả hai nhưng chỉ câu đầu chỉ được đường đi.
 */
export function canDao(t: TinhTrangPhieu): KetQuaDao {
  if (t.kind !== 'receipt' && t.kind !== 'issue') {
    return {
      duoc: false,
      vuong:
        t.kind === 'stocktake'
          ? 'Biên bản kiểm kê không đảo bằng phiếu đảo'
          : 'Chỉ phiếu nhập và phiếu xuất mới đảo được',
      goBang:
        t.kind === 'stocktake'
          ? 'Kiểm kê có vòng duyệt riêng — từ chối biên bản ở màn duyệt kiểm kê, hoặc kiểm đếm lại và lập biên bản mới.'
          : 'Lập một phiếu nhập hoặc phiếu xuất thường để chỉnh lại tồn.',
    }
  }
  if (t.status !== 'posted') {
    return {
      duoc: false,
      vuong:
        t.status === 'pending'
          ? 'Phiếu chưa áp sổ — chưa có gì để đảo'
          : 'Phiếu đã bị từ chối — chưa bao giờ vào sổ',
      goBang: 'Tồn kho chưa đổi vì tờ này, nên không cần đảo. Đóng lại là xong.',
    }
  }
  if (t.laPhieuDao) {
    return {
      duoc: false,
      vuong: 'Đây đã là một phiếu đảo',
      goBang:
        'Đảo tiếp thì sổ thành vòng tròn không ai đọc được. Sai nữa thì lập phiếu nhập / phiếu xuất thường cho đúng số thật.',
    }
  }
  if (t.daBiDaoBoi) {
    return {
      duoc: false,
      vuong: `Phiếu đã được đảo bởi ${t.daBiDaoBoi}`,
      goBang: `Mở ${t.daBiDaoBoi} để xem phần đã ghi ngược. Một tờ chỉ đảo một lần.`,
    }
  }
  if (t.coHangLoai) {
    return {
      duoc: false,
      vuong: 'Phiếu có hàng QC loại — đường đảo tự động không xử được',
      goBang:
        'Phần loại đã vào đối chiếu NCC nhưng chưa vào tồn, đảo máy sẽ lệch hai sổ. Xử bằng phiếu trả hàng NCC (mã X3).',
    }
  }
  if (t.soDong === 0) {
    return {
      duoc: false,
      vuong: 'Phiếu không có dòng nào',
      goBang:
        'Không có bút toán nào để ghi ngược. Báo quản trị nếu tờ này lẽ ra phải có dòng.',
    }
  }
  return {
    duoc: true,
    canhBao:
      t.kind === 'receipt'
        ? 'Đảo phiếu nhập là ghi xuất ngược ra — hàng phải còn đủ trong kho. Đã lấy ra dùng thì lượt đảo sẽ bị chặn.'
        : null,
  }
}
