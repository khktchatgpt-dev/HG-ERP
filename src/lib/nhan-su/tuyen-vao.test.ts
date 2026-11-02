import { describe, expect, it } from 'vitest'
import { choNguoiTiep, formTrong, goiTuyen, kiemTuyen, type FormTuyen } from './tuyen-vao'

const f0 = formTrong({ ngayVao: '02/11/2026', caId: 'ca-ngay' })
const du: FormTuyen = {
  ...f0,
  ma: '7014',
  ten: 'Trần Thị Mỹ Duyên',
  boPhan: 'Tổ Hoàn Thiện Xưởng 2',
  chucVu: 'Công nhân hoàn thiện',
  gioiTinh: 'female',
  ngaySinh: '14/03/2001',
  cccd: '052 301 004 417',
  dienThoai: '0905.123.456',
  choO: 'Khu phố 3',
}

describe('kiểm hộp Tuyển vào', () => {
  it('đủ ba ô bắt buộc + mã → lưu được, không còn ô trống', () => {
    expect(kiemTuyen(du, ['15', '62'], true)).toEqual({ chan: [], trong: [] })
  })
  it('thiếu ô bắt buộc → chặn theo thứ tự trên hộp (mã, họ tên, bộ phận, ngày vào)', () => {
    const k = kiemTuyen(f0, [], true)
    expect(k.chan.map((x) => x.o)).toEqual(['ma', 'ten', 'boPhan'])
    expect(kiemTuyen({ ...du, ngayVao: '' }, [], true).chan.map((x) => x.o)).toEqual([
      'ngayVao',
    ])
  })
  it('mã đã có người (kể cả viết 0 đầu) → chặn; Không chấm công thì không hỏi mã', () => {
    expect(kiemTuyen({ ...du, ma: '015' }, ['15'], true).chan[0].loi).toContain(
      'đã có người',
    )
    expect(kiemTuyen({ ...du, khongCham: true, ma: '' }, ['15'], true).chan).toEqual([])
  })
  it('ô cá nhân trống → chỉ nói ra (lưu được); sai định dạng → chặn', () => {
    const k = kiemTuyen({ ...du, dienThoai: '', ngaySinh: '' }, [], true)
    expect(k.chan).toEqual([])
    expect(k.trong).toEqual(['ngaySinh', 'dienThoai'])
    const s = kiemTuyen({ ...du, cccd: '05230100441' }, [], true)
    expect(s.chan.map((x) => x.o)).toEqual(['cccd'])
  })
  it('không có quyền thông tin riêng → bỏ qua cả nhóm cá nhân', () => {
    expect(kiemTuyen({ ...du, cccd: 'sai', dienThoai: '' }, [], false)).toEqual({
      chan: [],
      trong: [],
    })
  })
})

describe('gói gửi lên', () => {
  it('chuẩn hoá ngày ISO, CCCD / SĐT chỉ chữ số; bỏ ô trống', () => {
    const g = goiTuyen({ ...du, choO: '', deviceUserId: 'du-1' }, true)
    expect(g).toMatchObject({
      khong_cham: false,
      code: '7014',
      device_user_id: 'du-1',
      hire_date: '2026-11-02',
      team: 'Tổ Hoàn Thiện Xưởng 2',
      ca_nhan: {
        gender: 'female',
        birth_date: '2001-03-14',
        national_id: '052301004417',
        phone: '0905123456',
      },
    })
    expect(g.ca_nhan).not.toHaveProperty('current_address')
  })
  it('Không chấm công: không gửi mã, không ghép mã máy; không quyền riêng: không gửi ca_nhan', () => {
    const g = goiTuyen({ ...du, khongCham: true, deviceUserId: 'du-1' }, false)
    expect(g).not.toHaveProperty('code')
    expect(g).not.toHaveProperty('device_user_id')
    expect(g).not.toHaveProperty('ca_nhan')
  })
})

describe('người kế tiếp trong lượt', () => {
  it('giữ bộ phận, chức vụ, ngày vào, ca, kiểu chấm công; xoá người', () => {
    const n = choNguoiTiep({ ...du, khongCham: true, ghiChu: 'x' })
    expect(n).toMatchObject({
      boPhan: du.boPhan,
      chucVu: du.chucVu,
      ngayVao: du.ngayVao,
      caId: du.caId,
      khongCham: true,
      ten: '',
      ma: '',
      cccd: '',
      ghiChu: '',
      deviceUserId: null,
    })
  })
})
