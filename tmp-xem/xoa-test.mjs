import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('D:/HG-ERP/.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^"|"$/g,'')]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY)
const LSX='b9f29a0d-0905-4a68-8f41-42f56c59602c', ORDER='a3c51cdd-4470-46c8-a714-55dbc2c0d006', CUST='a5815911-4d58-44ad-92c0-b6fc62b62af5'
// Kiểm đúng id trước khi xoá — xoá nhầm là mất lệnh thật.
const { data: l } = await sb.from('production_orders').select('id,code').eq('id', LSX).maybeSingle()
const { data: o } = await sb.from('sales_orders').select('id,code').eq('id', ORDER).maybeSingle()
const { data: c } = await sb.from('sales_customers').select('id,name').eq('id', CUST).maybeSingle()
console.log('lệnh:', l?.code, '| đơn:', o?.code, '| khách:', c?.name)
if (l?.code !== 'TEST-E2E 11/26' || o?.code !== 'TEST-E2E-1011' || !c?.name?.startsWith('TEST E2E')) { console.log('KHÔNG KHỚP — dừng'); process.exit(1) }
for (const [t, id] of [['production_orders', LSX], ['sales_orders', ORDER], ['sales_customers', CUST]]) {
  const { error, count } = await sb.from(t).delete({ count: 'exact' }).eq('id', id)
  console.log(error ? `ERR ${t}: ${error.message}` : `xoá ${t}: ${count}`)
}
