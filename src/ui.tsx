import type { ReactNode } from 'react'
import * as Dropdown from '@radix-ui/react-dropdown-menu'
import * as Context from '@radix-ui/react-context-menu'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

export type Action = { label: string; run: () => void; icon?: ReactNode; disabled?: boolean }
export function Menu({ trigger, actions }: { trigger: ReactNode; actions: Action[] }) {
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>{trigger}</Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content className="menu" align="end" sideOffset={6}>
          {actions.map((a) => (
            <Dropdown.Item key={a.label} className="menu-item" disabled={a.disabled} onSelect={a.run}>
              {a.icon}
              {a.label}
            </Dropdown.Item>
          ))}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  )
}
export function RowMenu({ children, actions }: { children: ReactNode; actions: Action[] }) {
  return (
    <Context.Root>
      <Context.Trigger asChild>{children}</Context.Trigger>
      <Context.Portal>
        <Context.Content className="menu">
          {actions.map((a) => (
            <Context.Item key={a.label} className="menu-item" disabled={a.disabled} onSelect={a.run}>
              {a.icon}
              {a.label}
            </Context.Item>
          ))}
        </Context.Content>
      </Context.Portal>
    </Context.Root>
  )
}
export function Modal({
  title,
  subtitle,
  children,
  close,
}: {
  title: string
  subtitle: string
  children: ReactNode
  close: () => void
}) {
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="dialog">
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Description className="dialog-description">{subtitle}</Dialog.Description>
          <Dialog.Close asChild>
            <button className="icon dialog-close" aria-label="Close dialog">
              <X size={17} />
            </button>
          </Dialog.Close>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// Magic UI Orbiting Circles, adapted to a static orbital plate with an optional sweep.
export function OrbitPlate() {
  return (
    <svg className="orbit-plate" viewBox="0 0 640 250" aria-hidden="true">
      <defs>
        <pattern id="map-grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M24 0H0V24" fill="none" className="orbit-grid" />
        </pattern>
        <clipPath id="sphere">
          <circle cx="425" cy="122" r="102" />
        </clipPath>
      </defs>
      <path d="M90 0H640V250H90Z" fill="url(#map-grid)" />
      <g className="orbit-dim" fill="none">
        <circle cx="425" cy="122" r="102" />
        <circle cx="425" cy="122" r="117" strokeDasharray="2 5" />
        <ellipse cx="425" cy="122" rx="72" ry="102" />
        <ellipse cx="425" cy="122" rx="34" ry="102" />
        <path d="M320 122h210M425 15v215M337 72h176M337 172h176M366 38h118M366 206h118" />
        <ellipse cx="425" cy="122" rx="194" ry="56" transform="rotate(-22 425 122)" strokeDasharray="4 5" />
        <ellipse cx="425" cy="122" rx="172" ry="44" transform="rotate(28 425 122)" />
      </g>
      <g clipPath="url(#sphere)" className="orbit-land">
        <path d="M316 81l18-20 33-18 28 4 10 13-19 9 1 12-15 9-9 19 11 11-6 12-10-13-12-1-4-18-23-4zm64 47 20 9 19 22-7 18-13 9-8 20-9-6-4-27-11-20zm44-73 13-18 28-8 17 14-12 17-30 7zm47 34 11-13 48-12 26 21-6 27-23 7-9 18-13-10-6 13-9-17-14-3-8-15-15 3-2-11zm-10 28 18 8 9 22-13 29-14 8-5-20-11-16 4-23zm43 60 21-12 22 17-14 14-23-3z" />
      </g>
      <g fill="none" className="orbit-line">
        <ellipse cx="425" cy="122" rx="177" ry="46" transform="rotate(-22 425 122)" />
        <path d="M283 184l20-9m254-109 18-8M551 164h42l10-10" />
      </g>
      <g className="orbit-point">
        <circle cx="303" cy="175" r="3" />
        <circle cx="557" cy="66" r="4" />
        <circle cx="521" cy="151" r="3" />
        <circle cx="374" cy="111" r="2.5" />
        <circle cx="603" cy="154" r="2" />
      </g>
      <g className="orbit-faint" fill="none">
        <circle cx="557" cy="66" r="9" />
        <circle cx="303" cy="175" r="7" />
        <path d="M245 44h10m-5-5v10M586 208h10m-5-5v10M602 103h8m-4-4v8" />
      </g>
    </svg>
  )
}
