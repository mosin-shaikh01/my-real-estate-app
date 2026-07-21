import { Router } from 'express'
import {
  EXPORTABLE_REPORTS,
  FOLLOW_UP_STATUS_LABELS,
  PROPERTY_TYPE_LABELS,
  type ExportableReport,
  type FollowUpStatus,
  type PropertyType,
} from '@app/shared'
import { requirePermission } from '../middleware/authenticate.js'
import { notFound } from '../lib/errors.js'
import { toCsv, type CsvCell } from '../lib/csv.js'
import {
  agentPerformance,
  followUpStatus,
  monthlyRevenue,
  propertySales,
  reportsBundle,
} from '../services/report-service.js'

// Reports — admin-only. report.view reads; report.export downloads CSV (a
// separate permission so a role can read reports without bulk-exfiltrating).
export const reportRouter = Router()

reportRouter.get('/', requirePermission('report.view'), async (_req, res) => {
  res.json({ data: await reportsBundle() })
})

// One export endpoint, the report named in the path. Guarded by report.export.
reportRouter.get('/export/:report', requirePermission('report.export'), async (req, res) => {
  const report = String(req.params.report) as ExportableReport
  if (!EXPORTABLE_REPORTS.includes(report)) throw notFound('Unknown report')

  let headers: string[]
  let rows: CsvCell[][]

  switch (report) {
    case 'agent-performance': {
      headers = ['Agent', 'Code', 'Deals closed', 'Revenue', 'Commission', 'Active clients', 'Active properties']
      rows = (await agentPerformance()).map((r) => [
        r.agentName,
        r.agentCode,
        r.dealsClosed,
        r.revenue,
        r.commission,
        r.activeClients,
        r.activeProperties,
      ])
      break
    }
    case 'property-sales': {
      headers = ['Property type', 'Deals closed', 'Revenue']
      rows = (await propertySales()).map((r) => [
        PROPERTY_TYPE_LABELS[r.propertyType as PropertyType] ?? r.propertyType,
        r.dealsClosed,
        r.revenue,
      ])
      break
    }
    case 'follow-up-status': {
      headers = ['Follow-up status', 'Clients']
      rows = (await followUpStatus()).map((r) => [
        FOLLOW_UP_STATUS_LABELS[r.status as FollowUpStatus] ?? r.status,
        r.count,
      ])
      break
    }
    case 'monthly-revenue': {
      headers = ['Month', 'Deals closed', 'Revenue']
      rows = (await monthlyRevenue()).map((r) => [r.month, r.dealsClosed, r.revenue])
      break
    }
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${report}.csv"`)
  res.send(toCsv(headers, rows))
})
