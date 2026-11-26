import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'

export function SettingsDetail({ title, description, children }: {
  title: string
  description?: string
  children: ReactNode
}) {
  return <details className="settings-section settings-detail settings-optional">
    <summary>
      <span><strong>{title}</strong>{description && <small>{description}</small>}</span>
      <ChevronDown size={17} aria-hidden="true" />
    </summary>
    <div className="settings-optional-content">{children}</div>
  </details>
}
