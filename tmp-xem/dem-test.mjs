import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('D:/HG-ERP/.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^"|"$/g,'')]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY)
const LSX='b9f29a0d-0905-4a68-8f41-42f56c59602c', ORDER='a3c51cdd-4470-46c8-a714-55dbc2c0d006', CUST='a5815911-4d58-44ad-92c0-b6fc62b62af5'
const probes = [
  ['production_entries','production_order_id',LSX],
  ['production_entry_docs','production_order_id',LSX],
  ['production_transfers','production_order_id',LSX],
  ['production_transfer_docs','production_order_id',LSX],
  ['production_jobs','production_order_id',LSX],
  ['production_plan_changes','production_order_id',LSX],
  ['production_components','production_order_id',LSX],
  ['production_order_lines','production_order_id',LSX],
  ['production_order_groups','production_order_id',LSX],
  ['production_bom_snapshots','production_order_id',LSX],
  ['production_daily_targets','production_order_id',LSX],
  ['production_notes','production_order_id',LSX],
  ['production_order_revisions','production_order_id',LSX],
  ['production_order_orders','production_order_id',LSX],
  ['lsx_change_log','production_order_id',LSX],
  ['files','production_order_id',LSX],
  ['activity_log','entity_id',LSX],
  ['notifications','entity_id',LSX],
  ['sales_order_shipments','order_id',ORDER],
  ['sales_order_lines','order_id',ORDER],
  ['sales_order_history','order_id',ORDER],
  ['sales_order_events','order_id',ORDER],
  ['files','sales_order_id',ORDER],
  ['activity_log','entity_id',ORDER],
  ['sales_orders','id',ORDER],
  ['sales_orders','customer_id',CUST],
  ['sales_quotes','customer_id',CUST],
  ['sales_customers','id',CUST],
  ['production_orders','id',LSX],
]
for (const [t,c,v] of probes) {
  const { count, error } = await sb.from(t).select('*',{count:'exact',head:true}).eq(c,v)
  console.log((error? 'ERR '+error.message.slice(0,60) : count), '\t', t, c)
}
