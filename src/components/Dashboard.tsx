import { useId, useState } from 'react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { CreateLinkForm } from './CreateLinkForm'
import { TabPanel, Tabs, type TabItem } from './Tabs'

type TabId = 'create' | 'links'

const TABS: readonly TabItem<TabId>[] = [
  { id: 'create', label: 'Create link' },
  { id: 'links', label: 'My links' },
]

export function Dashboard() {
  useDocumentTitle('Link Shortener')
  const idPrefix = useId()
  const [tab, setTab] = useState<TabId>('create')

  return (
    <>
      <div className="page-intro">
        <h1>Shorten a link</h1>
        <p>Paste a long URL to get a short one that redirects. Every visit is counted so you can see what gets used.</p>
      </div>

      <Tabs tabs={TABS} selected={tab} onSelect={setTab} label="Link Shortener sections" idPrefix={idPrefix} />

      <TabPanel idPrefix={idPrefix} id="create" selected={tab === 'create'}>
        <section className="card" aria-labelledby={`${idPrefix}-create-heading`}>
          <h2 className="panel-heading" id={`${idPrefix}-create-heading`}>
            Create a short link
          </h2>
          <p className="panel-lead">Paste the address you want to share. Add your own alias if you like.</p>
          <div className="panel-body">
            <CreateLinkForm onCreated={() => {}} onViewLinks={() => setTab('links')} />
          </div>
        </section>
      </TabPanel>

      <TabPanel idPrefix={idPrefix} id="links" selected={tab === 'links'}>
        <section className="card" aria-labelledby={`${idPrefix}-links-heading`}>
          <h2 className="panel-heading" id={`${idPrefix}-links-heading`}>
            My links
          </h2>
        </section>
      </TabPanel>
    </>
  )
}
