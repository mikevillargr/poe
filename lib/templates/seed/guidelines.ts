// All client guideline sets from the n8n doc, in cutover order (NCH last).

import { LFP_GUIDELINES, SPP_GUIDELINES } from './auto-parts/guidelines'
import { NCH_GUIDELINES } from './nch/guidelines'
import { TENDERBITES_GUIDELINES } from './tenderbites/guidelines'
import { TWS_GUIDELINES } from './the-watch-store/guidelines'
import { UT_GUIDELINES } from './united-tribes/guidelines'
import type { ClientGuidelineSet } from './guideline-types'

export const CLIENT_GUIDELINE_SETS: ClientGuidelineSet[] = [
  LFP_GUIDELINES,
  SPP_GUIDELINES,
  TENDERBITES_GUIDELINES,
  TWS_GUIDELINES,
  UT_GUIDELINES,
  NCH_GUIDELINES,
]

export type { ClientGuidelineSet, DocGuideline } from './guideline-types'
