// Mục lục trang tài liệu theo họ — khớp 1-1 với KIT_FAMILIES (kit-docs.test.tsx canh).
import type { ComponentType } from 'react'
import D_btn from './btn'
import D_tag from './tag'
import D_code from './code'
import D_num from './num'
import D_coverage_bar from './coverage-bar'
import D_notice_bar from './notice-bar'
import D_loading from './loading'
import D_empty from './empty'
import D_icon from './icon'
import D_num_input from './num-input'
import D_text_input from './text-input'
import D_pick from './pick'
import D_tick from './tick'
import D_combobox from './combobox'
import D_date_input from './date-input'
import D_table from './table'
import D_filter_bar from './filter-bar'
import D_table_engine from './table-engine'
import D_grid from './grid'
import D_matrix_table from './matrix-table'
import D_doc_screen from './doc-screen'
import D_crumb from './crumb'
import D_action_pane from './action-pane'
import D_doc_head from './doc-head'
import D_holder_bar from './holder-bar'
import D_doc_status from './doc-status'
import D_doc_menu from './doc-menu'
import D_scope_switch from './scope-switch'
import D_hint from './hint'
import D_text_link from './text-link'
import D_checks from './checks'
import D_fast_tab from './fast-tab'
import D_field_grid from './field-grid'
import D_line_status from './line-status'
import D_line_detail from './line-detail'
import D_fact_box from './fact-box'
import D_audit_table from './audit-table'
import D_smart_links from './smart-links'
import D_metric_strip from './metric-strip'
import D_master_warn from './master-warn'
import D_head_chips from './head-chips'
import D_commit_bar from './commit-bar'
import D_timeline from './timeline'
import D_next_action from './next-action'
import D_doc_chain from './doc-chain'
import D_primary_step from './primary-step'
import D_notes from './notes'
import D_tip from './tip'
import D_menu from './menu'
import D_popover from './popover'
import D_sheet from './sheet'
import D_toast from './toast'
import D_screen_frame from './screen-frame'
import D_work_lanes from './work-lanes'
import D_work_tiles from './work-tiles'
import D_inspect_panel from './inspect-panel'
import D_why_box from './why-box'
import D_command_bar from './command-bar'
import D_app_shell from './app-shell'
import D_dual_pct from './dual-pct'
import D_delta_num from './delta-num'
import D_day_strip from './day-strip'
import D_mini_bars from './mini-bars'

export const DOCS: Record<string, ComponentType> = {
  'btn': D_btn,
  'tag': D_tag,
  'code': D_code,
  'num': D_num,
  'coverage-bar': D_coverage_bar,
  'notice-bar': D_notice_bar,
  'loading': D_loading,
  'empty': D_empty,
  'icon': D_icon,
  'num-input': D_num_input,
  'text-input': D_text_input,
  'pick': D_pick,
  'tick': D_tick,
  'combobox': D_combobox,
  'date-input': D_date_input,
  'table': D_table,
  'filter-bar': D_filter_bar,
  'table-engine': D_table_engine,
  'grid': D_grid,
  'matrix-table': D_matrix_table,
  'doc-screen': D_doc_screen,
  'crumb': D_crumb,
  'action-pane': D_action_pane,
  'doc-head': D_doc_head,
  'holder-bar': D_holder_bar,
  'doc-status': D_doc_status,
  'doc-menu': D_doc_menu,
  'scope-switch': D_scope_switch,
  hint: D_hint,
  'text-link': D_text_link,
  'checks': D_checks,
  'fast-tab': D_fast_tab,
  'field-grid': D_field_grid,
  'line-status': D_line_status,
  'line-detail': D_line_detail,
  'fact-box': D_fact_box,
  'audit-table': D_audit_table,
  'smart-links': D_smart_links,
  'metric-strip': D_metric_strip,
  'master-warn': D_master_warn,
  'head-chips': D_head_chips,
  'commit-bar': D_commit_bar,
  'timeline': D_timeline,
  'next-action': D_next_action,
  'doc-chain': D_doc_chain,
  'primary-step': D_primary_step,
  'notes': D_notes,
  'tip': D_tip,
  'menu': D_menu,
  'popover': D_popover,
  'sheet': D_sheet,
  'toast': D_toast,
  'screen-frame': D_screen_frame,
  'work-lanes': D_work_lanes,
  'work-tiles': D_work_tiles,
  'inspect-panel': D_inspect_panel,
  'why-box': D_why_box,
  'command-bar': D_command_bar,
  'app-shell': D_app_shell,
  'dual-pct': D_dual_pct,
  'delta-num': D_delta_num,
  'day-strip': D_day_strip,
  'mini-bars': D_mini_bars,
}
