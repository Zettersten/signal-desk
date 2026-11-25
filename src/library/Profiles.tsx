import { useState } from 'react'
import { ArrowUpRight, Building2, Clock3, Globe2, Newspaper, Search } from 'lucide-react'
import { categories, sortSignals, type Catalog, type Competitor, type Entity, type Signal } from '../data'
import { openWebsite } from '../native'

export function EntityMark({ entity }: { entity: Entity }) {
  const [failed, setFailed] = useState(false)
  return (
    <span
      className={`mark entity-mark ${entity.tone}`}
      aria-hidden="true"
      title={entity.logoKind === 'sample' ? 'Illustrative profile mark, not an official logo' : undefined}
    >
      {entity.logo && !failed ? (
        <img src={entity.logo} alt="" onError={() => setFailed(true)} />
      ) : (
        entity.mark
      )}
    </span>
  )
}

export function WebsiteButton({ url, text }: { url: string; text: string }) {
  const [error, setError] = useState(false)
  return (
    <span className="website-action">
      <button
        className="button"
        onClick={() =>
          void openWebsite(url)
            .then(() => setError(false))
            .catch(() => setError(true))
        }
      >
        {text} <ArrowUpRight size={14} />
      </button>
      {error && (
        <span role="alert" className="error">
          Could not open website.
        </span>
      )}
    </span>
  )
}

export function RecordTable({ rows, open }: { rows: Signal[]; open: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const visible = sortSignals(
    rows.filter(
      (row) =>
        (!category || row.category === category) &&
        `${row.title} ${row.company} ${row.publisher} ${row.paragraphs.map((p) => p.text).join(' ')}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    ),
    'Latest first',
  )
  return (
    <section className="library-section" aria-labelledby="record-table-title">
      <div className="library-section-head">
        <div>
          <h2 id="record-table-title">Captured records</h2>
          <p>
            {visible.length} of {rows.length} records
          </p>
        </div>
        <div className="library-tools">
          <label className="library-search">
            <Search size={15} />
            <input
              type="search"
              aria-label="Search captured records"
              placeholder="Search captured records"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select aria-label="Record category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>
      {!visible.length ? (
        <p className="library-empty">
          {rows.length ? 'No records match these filters.' : 'No records have been captured yet.'}
        </p>
      ) : (
        <table className="library-table record-table">
          <thead>
            <tr>
              <th scope="col">Record</th>
              <th scope="col">Category</th>
              <th scope="col">Published</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id}>
                <td>
                  <button className="library-link" onClick={() => open(row.id)}>
                    {row.title} <ArrowUpRight size={13} />
                  </button>
                  <small>
                    {row.publisher} / {row.company}
                  </small>
                </td>
                <td>{row.category}</td>
                <td>
                  <time dateTime={row.publishedAt}>{row.publishedAt.slice(0, 10)}</time>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

function CompanyDetails({
  company,
  sample,
  historyUnavailable,
  open,
}: {
  company: Competitor
  sample: boolean
  historyUnavailable: boolean
  open: (id: string) => void
}) {
  return (
    <>
      <div className="company-overview">
        <div>
          <h2>Overview</h2>
          <p>{company.overview}</p>
          <dl>
            {company.foundedYear && (
              <>
                <dt>Reported founding year</dt>
                <dd>{company.foundedYear}</dd>
              </>
            )}
            <dt>{company.incorporated?.sample ? 'Example incorporation date' : 'Legal incorporation'}</dt>
            <dd>{company.incorporated?.date ?? 'Not verified'}</dd>
          </dl>
          {company.incorporated?.detail && <p>{company.incorporated.detail}</p>}
          {company.incorporated?.source && (
            <WebsiteButton url={company.incorporated.source} text="Incorporation source" />
          )}
        </div>
        <figure>
          <img src={company.image.src} alt={company.image.alt} />
          <figcaption>{company.image.caption}</figcaption>
        </figure>
      </div>
      <section className="library-section">
        <div className="library-section-head">
          <div>
            <h2>Capabilities</h2>
            <p>
              {sample
                ? 'Illustrative coverage, not an operational assessment.'
                : 'Product and market coverage.'}
            </p>
          </div>
        </div>
        <table className="library-table">
          <thead>
            <tr>
              <th scope="col">Capability</th>
              <th scope="col">Domain</th>
              <th scope="col">Position</th>
            </tr>
          </thead>
          <tbody>
            {company.capabilities.map((c) => (
              <tr key={c.name}>
                <td>
                  <strong>{c.name}</strong>
                  <small>{c.description}</small>
                </td>
                <td>{c.category}</td>
                <td>
                  <span className="category">{c.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="library-section">
        <div className="library-section-head">
          <div>
            <h2>Financials</h2>
            <p>
              {sample
                ? 'Figures shown are fictional examples, not market data.'
                : 'Reported figures by period.'}
            </p>
          </div>
        </div>
        <table className="library-table">
          <thead>
            <tr>
              <th scope="col">Metric</th>
              <th scope="col">Value</th>
              <th scope="col">Coverage</th>
            </tr>
          </thead>
          <tbody>
            {company.financials.map((f) => (
              <tr key={f.label}>
                <th scope="row">{f.label}</th>
                <td>
                  {f.value ?? 'Not available'}
                  {f.period && <small>{f.period}</small>}
                </td>
                <td>{f.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="library-section">
        <div className="library-section-head">
          <div>
            <h2>Profile activity</h2>
            <p>Catalog changes observed on this device, plus supplied history.</p>
          </div>
        </div>
        {historyUnavailable && (
          <p role="status" className="library-empty">
            Local activity could not be saved. The catalog is still available.
          </p>
        )}
        {!company.activity.length && <p className="library-empty">No profile changes recorded yet.</p>}
        <ul className="activity-list">
          {[...company.activity]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((item) => (
              <li key={`${item.date}-${item.title}-${item.recordId ?? item.details}`}>
                <Clock3 size={15} />
                <div>
                  {item.recordId ? (
                    <button className="library-link" onClick={() => open(item.recordId!)}>
                      {item.title}
                    </button>
                  ) : (
                    <strong>{item.title}</strong>
                  )}
                  <p>{item.details}</p>
                </div>
                <time dateTime={item.date} title={item.date}>
                  {item.date.slice(0, 10)}
                </time>
              </li>
            ))}
        </ul>
      </section>
    </>
  )
}

export function Profiles({
  catalog,
  view,
  navigate,
  open,
  historyUnavailable,
}: {
  catalog: Catalog
  view: string
  navigate: (view: string) => void
  open: (id: string) => void
  historyUnavailable: boolean
}) {
  const [query, setQuery] = useState('')
  const company = view.startsWith('competitor:')
    ? catalog.competitors.find((c) => c.id === view.slice(11))
    : undefined
  const publisher = view.startsWith('publisher:')
    ? catalog.publishers.find((p) => p.id === view.slice(10))
    : undefined
  const entity = company ?? publisher
  if (!entity && /^(competitor|publisher):/.test(view))
    return (
      <div className="library-content">
        <h1>Profile not found</h1>
        <p className="library-empty">This profile is not in the current catalog.</p>
        <button
          className="button"
          onClick={() => navigate(view.startsWith('competitor:') ? 'Competitors' : 'Publishers')}
        >
          Back to the directory
        </button>
      </div>
    )
  if (entity) {
    const rows = catalog.records.filter((row) =>
      company ? row.competitorId === entity.id : row.publisherId === entity.id,
    )
    return (
      <div className="library-content">
        <button className="text-button" onClick={() => navigate(company ? 'Competitors' : 'Publishers')}>
          ‹ All {company ? 'competitors' : 'publishers'}
        </button>
        <header className="library-heading">
          <EntityMark key={entity.id} entity={entity} />
          <div>
            <h1>{entity.name}</h1>
            <p>
              {company
                ? catalog.mode === 'sample'
                  ? 'Sample competitor profile'
                  : 'Competitor profile'
                : 'Publisher'}
              {entity.logoKind === 'sample' && ' · Illustrative mark'}
            </p>
          </div>
          {entity.website && (
            <WebsiteButton
              url={entity.website}
              text={new URL(entity.website).hostname.replace(/^www\./, '')}
            />
          )}
        </header>
        {company && (
          <CompanyDetails
            company={company}
            sample={catalog.mode === 'sample'}
            open={open}
            historyUnavailable={historyUnavailable}
          />
        )}
        <RecordTable key={entity.id} rows={rows} open={open} />
      </div>
    )
  }
  const companies = view === 'Competitors'
  const directory = companies ? catalog.competitors : catalog.publishers
  const visible = [...directory]
    .filter((p) => p.name.toLowerCase().includes(query.toLowerCase().trim()))
    .sort((a, b) => a.name.localeCompare(b.name))
  return (
    <div className="library-content">
      <header className="library-heading">
        <span className="library-symbol">{companies ? <Building2 /> : <Newspaper />}</span>
        <div>
          <h1>{companies ? 'Competitors' : 'Publishers'}</h1>
          <p>
            {companies
              ? 'Compare capabilities and find captured intelligence.'
              : 'Browse the sources behind captured records.'}
          </p>
        </div>
      </header>
      <label className="library-search directory-search">
        <Search size={15} />
        <input
          type="search"
          aria-label={companies ? 'Search competitors' : 'Search publishers'}
          placeholder={companies ? 'Search competitors' : 'Search publishers'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {!visible.length && <p className="library-empty">No matching profiles.</p>}
      <ul className="directory-list">
        {visible.map((p) => (
          <li key={p.id}>
            <button onClick={() => navigate(`${companies ? 'competitor' : 'publisher'}:${p.id}`)}>
              <EntityMark entity={p} />
              <span>
                <strong>{p.name}</strong>
                <small>
                  {companies && 'capabilities' in p
                    ? (p as Competitor).capabilities
                        .map((c) => c.category)
                        .filter((v, i, a) => a.indexOf(v) === i)
                        .join(' / ')
                    : p.website && new URL(p.website).hostname}
                </small>
              </span>
              <span className="directory-count">
                {catalog.records.filter((r) => (companies ? r.competitorId : r.publisherId) === p.id).length}{' '}
                records
              </span>
              {companies ? <ArrowUpRight size={16} /> : <Globe2 size={16} />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
