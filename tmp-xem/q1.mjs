import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('D:/HG-ERP/.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^"|"$/g,'')]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY)
const { data: parts, error } = await sb.from('technical_product_parts').select('product_id')
if (error) { console.error(error); process.exit(1) }
const cnt = {}
for (const p of parts) cnt[p.product_id] = (cnt[p.product_id]||0)+1
const ids = Object.entries(cnt).sort((a,b)=>b[1]-a[1]).slice(0,15).map(x=>x[0])
const { data: prods, error: e2 } = await sb.from('technical_products').select('id,code,name,customer_name,bom_status').in('id', ids); if(!prods) console.log('ERR', e2)
for (const p of prods) console.log(cnt[p.id], p.code, p.name, '|', p.customer_name, p.bom_status)
const { data: cust } = await sb.from('sales_customers').select('id,name,code,status').ilike('name','%test%')
console.log('customers test:', cust)
