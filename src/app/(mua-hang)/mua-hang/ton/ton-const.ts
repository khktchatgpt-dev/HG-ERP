/**
 * Hằng dùng chung giữa page (server) và TonView (client).
 *
 * PHẢI nằm ở module KHÔNG có 'use client' — để trong TonView thì Next biến
 * mọi export của file đó thành client-reference và server đọc ra `undefined`,
 * ra `range(0, NaN)` và danh sách rỗng mà không báo lỗi. Cùng bẫy đã ghi ở
 * `warehouse/materials/constants.ts`.
 *
 * 25 chứ không 50 như màn Vật tư: mỗi dòng ở đây mang 6 con số phải đọc và so
 * với nhau, không phải một dòng tra cứu lướt qua.
 */
export const PAGE_SIZE = 25
