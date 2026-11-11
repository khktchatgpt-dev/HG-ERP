import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('D:/HG-ERP/.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^"|"$/g,'')]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY)
const { data: lsx } = await sb.from('production_orders').select('id,code,status,priority,ship_date').in('status',['approved','in_progress']).order('ship_date')
const ids = lsx.map(l=>l.id)
const { data: jobs } = await sb.from('production_jobs').select('production_order_id,production_order_line_id,stage,team_department_id,planned_start,planned_end,status').in('production_order_id', ids)
const { data: lines } = await sb.from('production_order_lines').select('id,production_order_id,qty').in('production_order_id', ids)
const { data: comps } = await sb.from('production_components').select('production_order_id,production_order_line_id').in('production_order_id', ids)
const shaped = new Set(comps.map(c=>c.production_order_line_id))
for (const l of lsx) {
  const js = jobs.filter(j=>j.production_order_id===l.id)
  const ls = lines.filter(x=>x.production_order_id===l.id)
  const sh = ls.filter(x=>shaped.has(x.id)).length
  const linesWithJob = new Set(js.map(j=>j.production_order_line_id)).size
  console.log(l.code.padEnd(20), l.ship_date, 'ưu tiên', l.priority, '| dòng', ls.length, 'định hình', sh, 'SL', ls.reduce((a,x)=>a+Number(x.qty),0), '| jobs', js.length, 'dòng có KH', linesWithJob, 'thiếu hạn', js.filter(j=>!j.planned_end).length, 'thiếu tổ', js.filter(j=>!j.team_department_id).length, 'done', js.filter(j=>j.status==='done').length)
}
