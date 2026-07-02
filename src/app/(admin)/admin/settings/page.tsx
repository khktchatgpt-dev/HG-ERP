import { settingsService } from '@/modules/core/settings/settings.service'
import { SettingsForm } from './SettingsForm'

export default async function AdminSettingsPage() {
  const settings = await settingsService.getAll()
  return <SettingsForm initial={settings} />
}
