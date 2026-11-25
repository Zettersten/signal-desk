import type { Category, Competitor, Publisher } from '../data'
import { sampleMark, sampleProfileImage } from './profile-media'
import unseenlabsLogo from './media/marks/unseenlabs.png'
import spacenewsLogo from './media/marks/spacenews.png'
import planetLogo from './media/marks/planet.png'
import iceyeLogo from './media/marks/iceye.png'

const logos: Record<string, string> = { unseenlabs: unseenlabsLogo, planet: planetLogo, iceye: iceyeLogo }

const cap = (
  name: string,
  category: Category,
  description: string,
  status: Competitor['capabilities'][number]['status'] = 'Core offering',
) => ({ name, category, description, status })
type ProfileSeed = {
  id: string
  name: string
  mark: string
  tone: string
  website: string
  overview: string
  capabilities: Competitor['capabilities']
  year?: string
}
const profiles: ProfileSeed[] = [
  {
    id: 'unseenlabs',
    name: 'Unseenlabs',
    mark: 'U',
    tone: 'mint',
    website: 'https://unseenlabs.space/',
    year: '2015',
    overview:
      'French commercial space company focused on satellite-based radio-frequency data for maritime awareness. Relevant where customers compare RF-only monitoring with multi-source geospatial products.',
    capabilities: [
      cap('Space-based RF geolocation', 'RF Analytics', 'Commercial RF observations and geolocation data.'),
      cap('Maritime activity monitoring', 'Maritime Analytics', 'Maritime analytics using RF observations.'),
      cap(
        'Multi-source geospatial integration',
        'Earth Observation',
        'Track customer demand for RF paired with complementary datasets.',
        'Watch',
      ),
    ],
  },
  {
    id: 'kleos',
    name: 'Kleos Space',
    mark: 'K',
    tone: 'plum',
    website: 'https://www.kleos.space/',
    year: '2017',
    overview:
      'Historical RF geolocation business included for tracking changes to its commercial portfolio. Current operating status is not established by this sample.',
    capabilities: [
      cap('RF geolocation portfolio', 'RF Analytics', 'Historical RF data and analytics portfolio.', 'Watch'),
    ],
  },
  {
    id: 'spire',
    name: 'Spire Global',
    mark: 'S',
    tone: 'blue',
    website: 'https://spire.com/',
    year: '2012',
    overview:
      'Satellite-data and space-services business included as an adjacent competitor. Product and business ownership can change; verify the current offering before using this profile.',
    capabilities: [
      cap('Space services', 'Space Infrastructure', 'Payload hosting and commercial satellite services.'),
      cap(
        'Satellite-derived data',
        'Earth Observation',
        'Commercial delivery and integration of space-derived datasets.',
        'Adjacent offering',
      ),
    ],
  },
  {
    id: 'bae',
    name: 'BAE Systems',
    mark: 'BAE',
    tone: 'gold',
    website: 'https://www.baesystems.com/',
    overview:
      'Large aerospace and technology integrator with space systems and geospatial programs. Tracked as an adjacent integrator and channel participant.',
    capabilities: [
      cap(
        'Space systems integration',
        'Space Infrastructure',
        'Satellite manufacturing, instruments and systems integration.',
      ),
      cap(
        'Geospatial programs',
        'Earth Observation',
        'Integration of geospatial products and mission data.',
        'Adjacent offering',
      ),
    ],
  },
  {
    id: 'iceye',
    name: 'ICEYE',
    mark: 'I',
    tone: 'sky',
    website: 'https://www.iceye.com/',
    year: '2014',
    overview:
      'Commercial synthetic-aperture radar imagery and analytics provider. An adjacent comparison for customers combining imagery and RF evidence.',
    capabilities: [
      cap('SAR imagery', 'Earth Observation', 'Radar imagery and commercial imagery services.'),
      cap(
        'Monitoring analytics',
        'Maritime Analytics',
        'Geospatial monitoring workflows and analytics products.',
        'Adjacent offering',
      ),
    ],
  },
  {
    id: 'aurora',
    name: 'Aurora Insight',
    mark: 'A',
    tone: 'plum',
    website: 'https://www.maxar.com/',
    overview:
      'Spectrum analytics business tracked as an adjacent offering. The profile is historical and does not assert current ownership or operating status.',
    capabilities: [
      cap('Spectrum analytics', 'Spectrum & GNSS', 'Radio spectrum measurement and analysis.'),
      cap(
        'Geospatial delivery',
        'RF Analytics',
        'Integration of spectrum observations into geospatial products.',
        'Adjacent offering',
      ),
    ],
  },
  {
    id: 'planet',
    name: 'Planet Labs',
    mark: 'P',
    tone: 'mint',
    website: 'https://www.planet.com/',
    year: '2010',
    overview:
      'Earth observation company offering recurring satellite imagery and analysis. Tracked for product packaging, distribution and customer overlap.',
    capabilities: [
      cap(
        'Optical imagery',
        'Earth Observation',
        'Recurring optical Earth observation and imagery products.',
      ),
      cap('Change analysis', 'Earth Observation', 'Commercial monitoring and change-detection tools.'),
    ],
  },
  {
    id: 'umbra',
    name: 'Umbra',
    mark: 'U',
    tone: 'sky',
    website: 'https://umbra.space/',
    year: '2015',
    overview:
      'Commercial SAR company tracked for imagery access, data licensing and potential RF-plus-imagery partnerships.',
    capabilities: [
      cap('SAR imagery and tasking', 'Earth Observation', 'Commercial imagery and data collection services.'),
      cap(
        'Data distribution',
        'Earth Observation',
        'Partner access and distribution for imagery buyers.',
        'Adjacent offering',
      ),
    ],
  },
  {
    id: 'airbus',
    name: 'Airbus',
    mark: 'A',
    tone: 'gold',
    website: 'https://www.airbus.com/',
    overview:
      'Aerospace group whose space and geospatial businesses overlap with commercial satellite data and services.',
    capabilities: [
      cap(
        'Optical and radar data',
        'Earth Observation',
        'Commercial Earth observation imagery and geospatial services.',
      ),
      cap(
        'Space information services',
        'Space Domain Awareness',
        'Track commercial space-data interoperability and standards.',
        'Watch',
      ),
    ],
  },
  {
    id: 'rocket-lab',
    name: 'Rocket Lab',
    mark: 'R',
    tone: 'plum',
    website: 'https://www.rocketlabcorp.com/',
    year: '2006',
    overview:
      'Launch and space-systems company. An infrastructure watch rather than a direct substitute for RF analytics.',
    capabilities: [
      cap('Launch services', 'Space Infrastructure', 'Commercial launch services for small satellites.'),
      cap(
        'Satellite manufacturing',
        'Space Infrastructure',
        'Spacecraft and components for commercial constellations.',
      ),
    ],
  },
  {
    id: 'blacksky',
    name: 'BlackSky',
    mark: 'B',
    tone: 'blue',
    website: 'https://www.blacksky.com/',
    overview:
      'Commercial Earth observation and analytics company relevant to buyers assessing time-sensitive geospatial data.',
    capabilities: [
      cap('Optical imagery', 'Earth Observation', 'Commercial imagery and monitoring services.'),
      cap('Analytics delivery', 'Earth Observation', 'Geospatial analysis and enterprise integration.'),
    ],
  },
  {
    id: 'ghgsat',
    name: 'GHGSat',
    mark: 'G',
    tone: 'mint',
    website: 'https://www.ghgsat.com/',
    year: '2011',
    overview:
      'Satellite emissions-monitoring company. Adjacent market example for buyers evaluating specialized analytics and independent verification.',
    capabilities: [
      cap(
        'Emissions monitoring',
        'Earth Observation',
        'Satellite observations and analysis for emissions reporting.',
      ),
    ],
  },
]

// These invented data points demonstrate the fields, not the companies’ finances or legal history.
const examples = [
  ['2015-03-16', 330, -9, 28, 72],
  ['2017-04-11', 65, -6, 8, 19],
  ['2020-05-14', 420, -12, 30, 44],
  ['1998-08-17', 2860, 88, 620, 210],
  ['2014-10-22', 910, -17, 54, 128],
  ['2016-04-06', 145, -5, 15, 27],
  ['2020-12-15', 1275, -18, 61, 85],
  ['2015-11-05', 280, -7, 21, 53],
  ['1999-12-13', 4380, 152, 960, 240],
  ['2006-07-19', 1530, -15, 77, 96],
  ['2018-06-12', 255, -8, 24, 40],
  ['2011-09-14', 195, -4, 17, 31],
] as const

export const competitors: Competitor[] = profiles.map(({ year, ...profile }, index) => ({
  ...profile,
  logo: logos[profile.id] ?? sampleMark(profile, index),
  logoKind: logos[profile.id] ? 'official' : 'sample',
  foundedYear: year,
  incorporated:
    profile.id === 'planet'
      ? {
          date: '2020-12-15',
          detail:
            'Delaware incorporation of dMY Technology Group IV, the registrant subsequently renamed Planet Labs PBC.',
          source: 'https://www.sec.gov/Archives/edgar/data/1836833/000162828022013652/planetlabs424b3.htm',
        }
      : {
          date: examples[index][0],
          sample: true,
          detail: 'Fictional example. The legal incorporation date has not been verified.',
        },
  image: sampleProfileImage(profile, index),
  financials: [
    {
      label: 'Market value',
      period: 'Example snapshot',
      detail: 'Illustrative valuation; not a market quote.',
    },
    { label: 'Earnings', period: 'Example quarter', detail: 'Illustrative net income or loss.' },
    { label: 'Revenue', period: 'Example quarter', detail: 'Illustrative operating revenue.' },
    { label: 'Funding', period: 'Example financing history', detail: 'Illustrative cumulative financing.' },
  ].map((metric, position) => {
    const value = examples[index][position + 1] as number
    return { ...metric, value: `${value < 0 ? '−' : ''}USD ${Math.abs(value)}M` }
  }),
  activity: [
    {
      date: '2026-11-23',
      title: 'Profile created',
      details: 'Illustrative market scope and capabilities were added to the sample catalog.',
    },
  ],
}))

const publisherSeeds: Publisher[] = [
  {
    id: 'spacenews',
    name: 'SpaceNews',
    mark: 'SN',
    tone: 'blue',
    website: 'https://spacenews.com/',
    logo: spacenewsLogo,
  },
  {
    id: 'via-satellite',
    name: 'Via Satellite',
    mark: 'VS',
    tone: 'plum',
    website: 'https://www.satellitetoday.com/',
  },
  {
    id: 'space-intel-report',
    name: 'Space Intel Report',
    mark: 'SI',
    tone: 'mint',
    website: 'https://www.spaceintelreport.com/',
  },
  {
    id: 'uk-space-agency',
    name: 'UK Space Agency',
    mark: 'UK',
    tone: 'gold',
    website: 'https://www.gov.uk/government/organisations/uk-space-agency',
  },
  {
    id: 'satellite-today',
    name: 'Satellite Today',
    mark: 'ST',
    tone: 'sky',
    website: 'https://www.satellitetoday.com/',
  },
  {
    id: 'geo-week-news',
    name: 'Geo Week News',
    mark: 'GW',
    tone: 'blue',
    website: 'https://www.geoweeknews.com/',
  },
  { id: 'esa', name: 'ESA', mark: 'ESA', tone: 'plum', website: 'https://www.esa.int/' },
]
export const publishers: Publisher[] = publisherSeeds.map((publisher, index) => ({
  ...publisher,
  logo: publisher.logo ?? sampleMark(publisher, profiles.length + index),
  logoKind: publisher.logo ? 'official' : 'sample',
}))
