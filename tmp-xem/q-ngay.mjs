import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('D:/HG-ERP/.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^"|"$/g,'')]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY)
const c = async (t) => (await sb.from(t).select('*',{count:'exact',head:true})).count
console.log('entries:', await c('production_entries'), 'day_locks:', await c('production_day_locks'), 'entry_docs:', await c('production_entry_docs').catch(()=>'n/a'), 'transfer_docs:', await c('production_transfer_docs'))
const { data: locks } = await sb.from('production_day_locks').select('entry_date, team_department_id, locked_at').order('entry_date', {ascending:false}).limit(10)
console.log('locks sample:', JSON.stringify(locks))
const { data: u } = await sb.from('users').select('name,role,department_id,meta').limit(400)
const stat = u.filter(x => JSON.stringify(x.meta||{}).includes('production_stat'))
console.log('production_stat users:', stat.length, stat.map(x=>x.name).join(' | '))
const { data: d } = await sb.from('departments').select('id,name,stage_code').eq('workspace_id','production')
console.log('teams:', d.map(x=>`${x.name}:${x.stage_code||'-'}`).join(' | '))
