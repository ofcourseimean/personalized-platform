import { BrowserConnectionSection } from '../browser-connection/BrowserConnectionSection'
import { DeviceSyncSettings } from '../device-sync/DeviceSyncSettings'
import { HeartRateSettings } from '../heart-rate/HeartRateSettings'
import { ListeningSettings } from '../music-companion/ListeningSettings'
import { AppearanceSettings } from './AppearanceSettings'
import { AiSettingsSection } from './AiSettingsSection'
import { BackupSettingsSection } from './BackupSettingsSection'
import { CompanionGrowthSection } from './CompanionGrowthSection'
import { CompanionSettingsSection } from './CompanionSettingsSection'
import { CompanionPermissions } from './CompanionPermissions'
import { CompanionVoiceSettings } from './CompanionVoiceSettings'
import { ComputerCapabilitySettings } from './ComputerCapabilitySettings'
import { DesktopCompanionSettings } from './DesktopCompanionSettings'
import { EncryptionSettingsSection } from './EncryptionSettingsSection'
import { ModuleSettings } from './ModuleSettings'
import { RetainedResources } from './RetainedResources'
import { SettingsDetail } from './SettingsDetail'
import { TransferSettingsSection } from './TransferSettingsSection'
import { TrustSettingsSection } from './TrustSettingsSection'
import { WebSearchSettings } from './WebSearchSettings'
import type { SettingsPage } from './settingsCatalog'

export function SettingsPageContent({ page }: { page: SettingsPage }) {
  switch (page) {
    case 'appearance': return <AppearanceSettings />
    case 'modules': return <ModuleSettings />
    case 'desktop': return <DesktopCompanionSettings />
    case 'voice': return <CompanionVoiceSettings />
    case 'models': return <><CompanionSettingsSection /><SettingsDetail title="图像生成服务" description="OpenRouter 与图像模型"><AiSettingsSection /></SettingsDetail></>
    case 'memory': return <CompanionGrowthSection />
    case 'activity': return <><ListeningSettings /><HeartRateSettings /></>
    case 'browser': return <BrowserConnectionSection />
    case 'computer': return <ComputerCapabilitySettings />
    case 'search': return <WebSearchSettings />
    case 'sync': return <DeviceSyncSettings />
    case 'data': return <>
      <BackupSettingsSection />
      <SettingsDetail title="开放格式导入与导出" description="导入前可预览"><TransferSettingsSection /></SettingsDetail>
      <SettingsDetail title="保留的资源" description="旧曲库、图像与音频"><RetainedResources /></SettingsDetail>
    </>
    case 'privacy': return <TrustSettingsSection />
    case 'permissions': return <CompanionPermissions />
    case 'encryption': return <EncryptionSettingsSection />
  }
}
