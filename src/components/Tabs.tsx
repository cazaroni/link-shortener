import { useRef, type KeyboardEvent, type ReactNode } from 'react'

export interface TabItem<Id extends string> {
  id: Id
  label: string
}

interface TabsProps<Id extends string> {
  tabs: readonly TabItem<Id>[]
  selected: Id
  onSelect: (id: Id) => void
  /** Accessible name for the tablist. */
  label: string
  /** Unique prefix so tab and panel ids can reference each other. */
  idPrefix: string
}

function tabDomId(prefix: string, id: string) {
  return `${prefix}-tab-${id}`
}

function panelDomId(prefix: string, id: string) {
  return `${prefix}-panel-${id}`
}

/**
 * Accessible tablist (WAI-ARIA tabs pattern, automatic activation):
 * roving tabindex, Left/Right arrows with wrap-around, Home/End.
 */
export function Tabs<Id extends string>({ tabs, selected, onSelect, label, idPrefix }: TabsProps<Id>) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([])

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const count = tabs.length
    let next: number
    switch (event.key) {
      case 'ArrowRight':
        next = (index + 1) % count
        break
      case 'ArrowLeft':
        next = (index - 1 + count) % count
        break
      case 'Home':
        next = 0
        break
      case 'End':
        next = count - 1
        break
      default:
        return
    }
    event.preventDefault()
    const target = tabs[next]
    if (!target) return
    onSelect(target.id)
    buttons.current[next]?.focus()
  }

  return (
    <div className="tablist" role="tablist" aria-label={label}>
      {tabs.map((tab, index) => {
        const isSelected = tab.id === selected
        return (
          <button
            key={tab.id}
            ref={(node) => {
              buttons.current[index] = node
            }}
            type="button"
            role="tab"
            className="tab"
            id={tabDomId(idPrefix, tab.id)}
            aria-selected={isSelected}
            aria-controls={panelDomId(idPrefix, tab.id)}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onSelect(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

interface TabPanelProps {
  idPrefix: string
  id: string
  selected: boolean
  children: ReactNode
}

/** Panels stay mounted (just hidden) so form state survives switching tabs. */
export function TabPanel({ idPrefix, id, selected, children }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      id={panelDomId(idPrefix, id)}
      aria-labelledby={tabDomId(idPrefix, id)}
      hidden={!selected}
    >
      {children}
    </div>
  )
}
