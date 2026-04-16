import { useState, useEffect, useMemo, useRef } from 'react'
import { reportService } from '../../../services/reportService'
import { accountService } from '../../../services/accountService'
import { getUserRole } from '../../../utils/auth'
import {
  extractApiErrorMessage,
  mapReportToUi,
  mapMoneyFlowToUi,
  mapAccountToUi,
  pickList,
} from '../../../utils/frontendApiAdapters'
import { transactionService } from '../../../services/transactionService'
import { depensesService } from '../../../services/depensesService'

const FORMAT_OPTIONS = {
  currency: { style: 'currency', currency: 'EUR' },
  date: { day: '2-digit', month: '2-digit', year: 'numeric' },
  datetime: { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' },
}

const today = new Date().toISOString().split('T')[0]
const thisYear = new Date().getFullYear()
const thisMonth = String(new Date().getMonth() + 1).padStart(2, '0')

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

const PERIOD_OPTIONS = [
  { value: 'all', label: 'Toutes les données' },
  { value: 'year', label: 'Cette année' },
  { value: 'quarter', label: 'Ce trimestre' },
  { value: 'month', label: 'Ce mois' },
  { value: 'custom', label: 'Période personnalisée' },
]

const EMPTY_REPORT = { title: '', description: '', date: today }

// ─── Helpers ────────────────────────────────────────────────────────────────
const formatCurrency = (n) => (n || 0).toLocaleString('fr-FR', FORMAT_OPTIONS.currency)
const formatDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', FORMAT_OPTIONS.date) : ''
const formatDateTime = (d) => d ? new Date(d).toLocaleString('fr-FR', FORMAT_OPTIONS.datetime) : ''

function getPeriodRange(period, customStart, customEnd) {
  const now = new Date()
  if (period === 'all') return { start: null, end: null }
  if (period === 'month') {
    const s = new Date(now.getFullYear(), now.getMonth(), 1)
    const e = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return { start: s.toISOString().split('T')[0], end: e.toISOString().split('T')[0] }
  }
  if (period === 'quarter') {
    const q = Math.floor(now.getMonth() / 3)
    const s = new Date(now.getFullYear(), q * 3, 1)
    const e = new Date(now.getFullYear(), q * 3 + 3, 0)
    return { start: s.toISOString().split('T')[0], end: e.toISOString().split('T')[0] }
  }
  if (period === 'year') {
    return { start: `${now.getFullYear()}-01-01`, end: `${now.getFullYear()}-12-31` }
  }
  if (period === 'custom') return { start: customStart, end: customEnd }
  return { start: null, end: null }
}

function filterByPeriod(items, start, end) {
  return items.filter(item => {
    if (start && item.date && item.date < start) return false
    if (end && item.date && item.date > end) return false
    return true
  })
}

function groupByCategory(items) {
  const map = {}
  items.forEach(item => {
    const cat = item.category || 'Sans catégorie'
    if (!map[cat]) map[cat] = { total: 0, count: 0 }
    map[cat].total += Number(item.amount) || 0
    map[cat].count++
  })
  return Object.entries(map).sort((a, b) => b[1].total - a[1].total)
}

// ─── Pagination ──────────────────────────────────────────────────────────────
const Pagination = ({ total, pagination, setPagination }) => {
  const totalPages = Math.ceil(total / pagination.itemsPerPage)
  const start = total > 0 ? (pagination.currentPage - 1) * pagination.itemsPerPage + 1 : 0
  const end = Math.min(pagination.currentPage * pagination.itemsPerPage, total)
  return (
    <div className="pagination">
      <span className="pagination-info">{total > 0 ? `${start}-${end} sur ${total}` : '0 élément'}</span>
      <div className="pagination-controls">
        <button className="pagination-btn" onClick={() => setPagination(p => ({ ...p, currentPage: Math.max(1, p.currentPage - 1) }))} disabled={pagination.currentPage === 1}>←</button>
        {[...Array(totalPages)].map((_, i) => {
          const page = i + 1
          const show = page === 1 || page === totalPages || (page >= pagination.currentPage - 2 && page <= pagination.currentPage + 2)
          if (show) return <button key={page} className={`pagination-btn ${pagination.currentPage === page ? 'active' : ''}`} onClick={() => setPagination(p => ({ ...p, currentPage: page }))}>{page}</button>
          if (page === pagination.currentPage - 3 || page === pagination.currentPage + 3) return <span key={page} className="pagination-dots">...</span>
          return null
        })}
        <button className="pagination-btn" onClick={() => setPagination(p => ({ ...p, currentPage: Math.min(totalPages, p.currentPage + 1) }))} disabled={pagination.currentPage === totalPages || total === 0}>→</button>
      </div>
      <select className="pagination-limit" value={pagination.itemsPerPage} onChange={(e) => setPagination({ currentPage: 1, itemsPerPage: Number(e.target.value) })}>
        {[10, 25, 50, 100].map(v => <option key={v} value={v}>{v} par page</option>)}
      </select>
    </div>
  )
}

const NoResults = ({ onReset }) => (
  <div className="no-results"><p>Aucun résultat</p><button className="btn-reset" onClick={onReset}>Réinitialiser</button></div>
)

// ─── Financial Report HTML (used for preview + PDF) ─────────────────────────
const FinancialReportContent = ({ data, period }) => {
  const { revenues, expenses, accounts, periodLabel, generatedAt } = data
const totalRev = revenues.reduce((s, e) => s + e.amount, 0);
const totalExp = expenses.reduce((s, e) => s + e.amount, 0);
const totalSoldes = accounts.reduce((s, a) => s + a.solde, 0);
  const net = totalRev - totalExp;
  const revByCategory = groupByCategory(revenues)
  const expByCategory = groupByCategory(expenses)

  return (
    <div id="financial-report-content" style={{ fontFamily: 'Arial, sans-serif', color: '#2d3748', padding: '0' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #4299e1, #2b6cb0)', color: '#fff', padding: '28px 32px', borderRadius: '10px 10px 0 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700 }}>📊 Rapport Financier</h1>
            <p style={{ margin: '6px 0 0', opacity: 0.85, fontSize: '14px' }}>Période : {periodLabel}</p>
          </div>
          <div style={{ textAlign: 'right', fontSize: '12px', opacity: 0.8 }}>
            <div>Généré le</div>
            <div style={{ fontWeight: 600 }}>{generatedAt}</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '24px 32px', background: '#fff' }}>
        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '28px' }}>
          {[
            { label: 'Total Revenus', value: formatCurrency(totalRev), color: '#48bb78', bg: '#c6f6d5' },
            { label: 'Total Dépenses', value: formatCurrency(totalExp), color: '#f56565', bg: '#fed7d7' },
            { label: 'Soldes Comptes', value: formatCurrency(totalSoldes), color: '#4299e1', bg: '#bee3f8' },
            { label: 'NET', value: formatCurrency(net), color: net >= 0 ? '#48bb78' : '#f56565', bg: net >= 0 ? '#c6f6d5' : '#fed7d7' },
          ].map((card, i) => (
            <div key={i} style={{ background: card.bg, borderRadius: '8px', padding: '14px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{card.label}</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: card.color }}>{card.value}</div>
            </div>
          ))}
        </div>

        {/* Revenues by category */}
        <Section title="Revenus par catégorie" color="#48bb78">
          {revByCategory.length === 0
            ? <EmptyRow text="Aucun revenu sur cette période" />
            : revByCategory.map(([cat, { total, count }]) => (
              <CategoryRow key={cat} cat={cat} total={total} count={count} grandTotal={totalRev} color="#48bb78" />
            ))}
          <TotalRow label="Total revenus" value={formatCurrency(totalRev)} color="#48bb78" />
        </Section>

        {/* Expenses by category */}
        <Section title="Dépenses par catégorie" color="#f56565">
          {expByCategory.length === 0
            ? <EmptyRow text="Aucune dépense sur cette période" />
            : expByCategory.map(([cat, { total, count }]) => (
              <CategoryRow key={cat} cat={cat} total={total} count={count} grandTotal={totalExp} color="#f56565" />
            ))}
          <TotalRow label="Total dépenses" value={formatCurrency(totalExp)} color="#f56565" />
        </Section>

        {/* Accounts */}
        {accounts.length > 0 && (
          <Section title="Soldes des comptes" color="#4299e1">
            {accounts.map(a => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #edf2f7' }}>
                <span style={{ fontSize: '14px' }}>🏦 {a.name}</span>
                <span style={{ fontWeight: 600, color: (a.solde || 0) >= 0 ? '#48bb78' : '#f56565' }}>{formatCurrency(a.solde)}</span>
              </div>
            ))}
            <TotalRow label="Total soldes" value={formatCurrency(totalSoldes)} color="#4299e1" />
          </Section>
        )}

        {/* Net result */}
        <div style={{ marginTop: '24px', padding: '18px 24px', background: net >= 0 ? '#c6f6d5' : '#fed7d7', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '16px', fontWeight: 700, color: '#2d3748' }}>Résultat NET (Revenus - Dépenses + Soldes)</span>
          <span style={{ fontSize: '22px', fontWeight: 800, color: net >= 0 ? '#276749' : '#c53030' }}>{formatCurrency(net)}</span>
        </div>

        {/* Footer */}
        <p style={{ marginTop: '24px', fontSize: '11px', color: '#a0aec0', textAlign: 'center', borderTop: '1px solid #edf2f7', paddingTop: '12px' }}>
          Rapport généré automatiquement · {generatedAt}
        </p>
      </div>
    </div>
  )
}

const Section = ({ title, color, children }) => (
  <div style={{ marginBottom: '24px' }}>
    <h3 style={{ fontSize: '14px', fontWeight: 700, color, margin: '0 0 10px', borderBottom: `2px solid ${color}`, paddingBottom: '6px' }}>{title}</h3>
    {children}
  </div>
)

const CategoryRow = ({ cat, total, count, grandTotal, color }) => {
  const pct = grandTotal > 0 ? Math.round((total / grandTotal) * 100) : 0
  return (
    <div style={{ padding: '7px 0', borderBottom: '1px solid #edf2f7' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
        <span style={{ fontSize: '13px' }}>{cat} <span style={{ color: '#a0aec0', fontSize: '11px' }}>({count} entrée{count > 1 ? 's' : ''})</span></span>
        <span style={{ fontWeight: 600, fontSize: '13px', color }}>{formatCurrency(total)} <span style={{ color: '#a0aec0', fontWeight: 400 }}>({pct}%)</span></span>
      </div>
      <div style={{ height: '4px', background: '#edf2f7', borderRadius: '2px' }}>
        <div style={{ height: '4px', background: color, borderRadius: '2px', width: `${pct}%`, opacity: 0.7 }} />
      </div>
    </div>
  )
}

const TotalRow = ({ label, value, color }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', marginTop: '4px' }}>
    <span style={{ fontWeight: 700, fontSize: '13px' }}>{label}</span>
    <span style={{ fontWeight: 800, fontSize: '14px', color }}>{value}</span>
  </div>
)

const EmptyRow = ({ text }) => (
  <p style={{ color: '#a0aec0', fontSize: '13px', fontStyle: 'italic', margin: '4px 0' }}>{text}</p>
)

// ─── Generate Report Modal ────────────────────────────────────────────────────
const GenerateReportModal = ({ onClose, onGenerate, loading }) => {
  const [period, setPeriod] = useState('month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState(today)
  const [reportTitle, setReportTitle] = useState('')

  const periodLabel = PERIOD_OPTIONS.find(p => p.value === period)?.label || ''

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <h3>📊 Générer un rapport financier</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group">
            <label>Titre du rapport (optionnel)</label>
            <input type="text" value={reportTitle} onChange={e => setReportTitle(e.target.value)} placeholder={`Rapport financier - ${periodLabel}`} />
          </div>
          <div className="form-group">
            <label>Période *</label>
            <select value={period} onChange={e => setPeriod(e.target.value)} className="filter-select" style={{ width: '100%' }}>
              {PERIOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {period === 'custom' && (
            <div className="form-row">
              <div className="form-group">
                <label>Date de début *</label>
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} max={customEnd} />
              </div>
              <div className="form-group">
                <label>Date de fin *</label>
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} min={customStart} max={today} />
              </div>
            </div>
          )}
          <div style={{ background: '#ebf8ff', borderRadius: '8px', padding: '12px 16px', fontSize: '13px', color: '#2b6cb0' }}>
             Le rapport sera généré automatiquement .
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn-primary" style={{ background: '#4299e1' }}
            disabled={loading || (period === 'custom' && (!customStart || !customEnd))}
            onClick={() => onGenerate({ period, customStart, customEnd, title: reportTitle })}>
            {loading ? '⏳ Génération...' : '⚡ Générer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Preview + Download Modal ─────────────────────────────────────────────────
const PreviewModal = ({ reportData, reportTitle, onClose, onSave, saving }) => {
  const printRef = useRef()

  const handlePrint = () => {
    const content = document.getElementById('financial-report-content')
    if (!content) return
    const printWindow = window.open('', '_blank', 'width=900,height=700')
    printWindow.document.write(`
      <html>
        <head>
          <title>${reportTitle}</title>
          <style>
            body { margin: 0; font-family: Arial, sans-serif; }
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
          </style>
        </head>
        <body>${content.outerHTML}</body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => { printWindow.print(); printWindow.close() }, 400)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '780px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <h3>👁️ Aperçu du rapport</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" ref={printRef} style={{ overflowY: 'auto', flex: 1, padding: 0 }}>
          <FinancialReportContent data={reportData} />
        </div>
        <div className="modal-footer" style={{ gap: '8px' }}>
          <button className="btn-secondary" onClick={onClose}>Fermer</button>
          <button className="btn-secondary" onClick={handlePrint}>🖨️ Imprimer / PDF</button>
          {onSave && (
            <button className="btn-primary" style={{ background: '#4299e1' }} onClick={onSave} disabled={saving}>
              {saving ? '⏳ Sauvegarde...' : '💾 Sauvegarder'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Saved Report View Modal ──────────────────────────────────────────────────
const ReportViewModal = ({ report, onClose }) => {
  if (!report) return null;

  // Nejbdou el data mel snapshot elli khabineh fil DB
  const hasDynamicData = report.data && report.data.summary && report.data.details;
  const { summary, details } = hasDynamicData ? report.data : { summary: null, details: null };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '800px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>👁️ Contenu du rapport</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Info de base */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontWeight: 600, color: '#4a5568', fontSize: '0.8rem', textTransform: 'uppercase' }}>Titre</label>
            <p style={{ fontSize: '1.1rem', fontWeight: 700, color: '#2d3748', margin: '4px 0 0' }}>{report.title}</p>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontWeight: 600, color: '#4a5568', fontSize: '0.8rem', textTransform: 'uppercase' }}>Description</label>
            <p style={{ color: '#4a5568', margin: '4px 0 0', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {report.description || <em style={{ color: '#a0aec0' }}>Aucune description</em>}
            </p>
          </div>

          {/* Section Totaux - N'affichiwha ken ken fama data */}
          {summary && (
            <div className="report-summary-cards" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '20px' }}>
              <div className="card" style={{ padding: '10px', background: '#ebf8ff', borderRadius: '8px' }}>
                <small>Revenus</small>
                <div style={{ fontWeight: 'bold', color: '#2b6cb0' }}>{formatCurrency(summary.totalRevenues)}</div>
              </div>
              <div className="card" style={{ padding: '10px', background: '#fff5f5', borderRadius: '8px' }}>
                <small>Dépenses</small>
                <div style={{ fontWeight: 'bold', color: '#c53030' }}>{formatCurrency(summary.totalExpenses)}</div>
              </div>
              <div className="card-bold" style={{ padding: '10px', background: '#f0fff4', borderRadius: '8px', border: '1px solid #c6f6d5' }}>
                <small>NET</small>
                <div style={{ fontWeight: 'bold', color: '#2f855a' }}>{formatCurrency(summary.net)}</div>
              </div>
            </div>
          )}

          {/* Section Details - Tableau mta3 el transactions */}
          {details && (
            <div className="report-details-table" style={{ marginTop: '20px', maxHeight: '300px', overflowY: 'auto' }}>
              <h4 style={{ fontSize: '0.9rem', marginBottom: '10px', borderBottom: '1px solid #edf2f7', paddingBottom: '5px' }}>
                📊 Détails des opérations ({summary.periodLabel})
              </h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead style={{ background: '#f7fafc', textAlign: 'left' }}>
                  <tr>
                    <th style={{ padding: '8px' }}>Date</th>
                    <th style={{ padding: '8px' }}>Description</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {/* On combine revenues et expenses pour le tableau si besoin, ou on affiche l'un après l'autre */}
                  {[...(details.revenues || []), ...(details.expenses || [])]
                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                    .map((trx, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #edf2f7' }}>
                      <td style={{ padding: '8px' }}>{formatDate(trx.date)}</td>
                      <td style={{ padding: '8px' }}>{trx.description}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600, color: trx.isExpense ? '#e53e3e' : '#38a169' }}>
                        {trx.isExpense ? '-' : '+'}{formatCurrency(trx.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ display: 'flex', gap: '24px', padding: '12px', background: '#f7fafc', borderRadius: '8px', marginTop: '16px' }}>
            <div>
              <label style={{ fontWeight: 600, color: '#4a5568', fontSize: '0.75rem', textTransform: 'uppercase' }}>Date du rapport</label>
              <p style={{ margin: '2px 0 0', fontWeight: 600 }}>{formatDate(report.date)}</p>
            </div>
            <div>
              <label style={{ fontWeight: 600, color: '#4a5568', fontSize: '0.75rem', textTransform: 'uppercase' }}>Créé le</label>
              <p style={{ margin: '2px 0 0', fontWeight: 600 }}>{formatDateTime(report.createdAt)}</p>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function ReportsPage({ showNotif }) {
  const notify = (msg, type) => { if (typeof showNotif === 'function') showNotif(msg, type); else if (type === 'error') window.alert(msg) }

  const [reports, setReports] = useState([])
  const [filters, setFilters] = useState({ search: '' })
  const [pagination, setPagination] = useState({ currentPage: 1, itemsPerPage: 10 })
  const [modal, setModal] = useState({ isOpen: false, mode: 'add', item: null })
  const [formData, setFormData] = useState({ ...EMPTY_REPORT })
  const [viewReport, setViewReport] = useState(null)
  const [loading, setLoading] = useState(true)

  // Generate report state
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [previewData, setPreviewData] = useState(null)
  const [previewTitle, setPreviewTitle] = useState('')
  const [savingReport, setSavingReport] = useState(false)

  const loadData = async () => {
    try {
      const userRole = getUserRole()
      const res = await reportService.getAll({ limit: 200 })
      const list = pickList(res, ['data'])
        .filter(report => {
          if (userRole === 'admin_principal') return true
          const tags = report.tags || []
          return tags.length === 0 || tags.includes('source:finance')
        })
        .map(report => mapReportToUi(report, '📄'))
      setReports(list)
    } catch (error) {
      notify(extractApiErrorMessage(error, 'Impossible de charger les rapports'), 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  // ── Generate financial report from real data ──
 // REVENUS: On prend uniquement ce qui est crédit (Entrée d'argent)
// 1. Daxel el handleGenerate (Update hedhi)
const handleGenerate = async ({ period, customStart, customEnd, title }) => {
  setGeneratingReport(true);
  try {
    const { start, end } = getPeriodRange(period, customStart, customEnd);
    
    // Nejbdou el data mel blayes el kol fard marra
    const [transRes, expRes, accRes] = await Promise.all([
      transactionService.getAll({ limit: 5000 }), // Pour les Revenus
      depensesService?.getAll({ limit: 5000 }) || { data: [] }, // Pour les Dépenses (Thabbet f-esm el service)
      accountService.getAll({ limit: 100 })
    ]);

    const allTransactions = transRes.data || [];
    const allExpenses = expRes.data || [];
    const accounts = accRes.data || [];

    const dateFilter = (item) => {
      const d = new Date(item.date).toISOString().split('T')[0];
      const s = start || '1970-01-01';
      const e = end || today;
      return d >= s && d <= e;
    };

    // 1. REVENUS: Juste el transactions (Credit > 0)
    const revenues = allTransactions
      .filter(t => dateFilter(t) && Number(t.totalCredit) > 0)
      .map(t => ({
        id: t._id,
        date: t.date,
        description: t.description || 'Revenu transaction',
        amount: Number(t.totalCredit),
        category: t.category || 'Vente',
        isExpense: false
      }));

    // 2. DEPENSES: Nejbdouhom mel module Dépenses (ou Transactions Debit > 0)
    const expenses = allExpenses
      .filter(e => dateFilter(e))
      .map(e => ({
        id: e._id,
        date: e.date,
        description: e.description || 'Dépense',
        amount: Number(e.amount || e.totalDebit),
        category: e.category || 'Charges',
        isExpense: true
      }));

    setPreviewData({
      revenues,
      expenses,
      accounts: accounts.map(a => ({ id: a._id, name: a.name, solde: Number(a.balance) || 0 })),
      periodLabel: PERIOD_OPTIONS.find(p => p.value === period)?.label || period,
      generatedAt: new Date().toLocaleString('fr-FR', FORMAT_OPTIONS.datetime)
    });

    setPreviewTitle(title || `Rapport Financier - ${formatDate(new Date())}`);
    setShowGenerateModal(false);
  } catch (error) {
    console.error(error);
    notify('Erreur de génération', 'error');
  } finally { setGeneratingReport(false); }
};
  // ── Save report to backend ──
 const handleSaveReport = async () => {
  if (!previewData) return;
  setSavingReport(true);
  try {
    const totalRev = previewData.revenues.reduce((s, e) => s + e.amount, 0);
    const totalExp = previewData.expenses.reduce((s, e) => s + e.amount, 0);
    const totalSoldes = previewData.accounts.reduce((s, a) => s + a.solde, 0);
    const net = totalRev - totalExp + totalSoldes;

    const reportData = {
      summary: {
        totalRevenues: totalRev,
        totalExpenses: totalExp,
        totalAccounts: totalSoldes,
        net: net,
        periodLabel: previewData.periodLabel
      },
      details: {
        revenues: previewData.revenues,
        expenses: previewData.expenses,
        accounts: previewData.accounts
      }
    };

    await reportService.create({
      title: previewTitle,
      description: `NET: ${formatCurrency(net)} | Période: ${previewData.periodLabel}`,
      type: 'financier',
      date: new Date().toISOString(),
      data: reportData, // Houni el Snapshot kemel yemchi lel DB
      tags: ['source:finance', 'auto-generated']
    });

    await loadData();
    setPreviewData(null);
    notify('Rapport sauvegardé !');
  } catch (error) {
    notify('Erreur sauvegarde', 'error');
  } finally {
    setSavingReport(false);
  }
};

  const resetFilters = () => {
    setFilters({ search: '' })
    setPagination(p => ({ ...p, currentPage: 1 }))
  }

  const filteredData = useMemo(() => reports.filter(item => {
    if (filters.search) {
      const s = filters.search.toLowerCase()
      if (![item.title, item.description].some(f => f?.toLowerCase().includes(s))) return false
    }
    return true
  }), [reports, filters])

  const paginatedData = filteredData.slice(
    (pagination.currentPage - 1) * pagination.itemsPerPage,
    pagination.currentPage * pagination.itemsPerPage
  )

  const openModal = (mode, item = null) => {
    setFormData(item && mode === 'edit' ? { ...item } : { ...EMPTY_REPORT })
    setModal({ isOpen: true, mode, item })
  }
  const closeModal = () => { setModal({ isOpen: false, mode: 'add', item: null }); setFormData({ ...EMPTY_REPORT }) }

  const handleAdd = async () => {
    try {
      await reportService.create({ ...formData, tags: ['source:finance'] })
      await loadData(); closeModal(); notify('Rapport ajouté')
    } catch (error) { notify(extractApiErrorMessage(error, "Impossible d'ajouter le rapport"), 'error') }
  }
  const handleUpdate = async () => {
    try {
      await reportService.update(modal.item?.backendId || modal.item?.id, formData)
      await loadData(); closeModal(); notify('Rapport modifié')
    } catch (error) { notify(extractApiErrorMessage(error, 'Impossible de modifier le rapport'), 'error') }
  }
  const handleDelete = async () => {
    try {
      await reportService.delete(modal.item?.backendId || modal.item?.id)
      await loadData(); closeModal(); notify('Rapport supprimé')
    } catch (error) { notify(extractApiErrorMessage(error, 'Impossible de supprimer le rapport'), 'error') }
  }
  const handleReportDownload = async (report) => {
    try { await reportService.generatePdf(report.id) }
    catch (error) { notify(extractApiErrorMessage(error, 'Impossible de télécharger le rapport'), 'error') }
  }

  if (loading) return <div className="finance-loading"><div className="spinner"></div><p>Chargement...</p></div>

  return (
    <div className="reports-content">
      {/* Action bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginBottom: '12px' }}>
        <button className="btn-primary" style={{ background: '#38a169' }} onClick={() => setShowGenerateModal(true)}>
          ⚡ Générer un rapport financier
        </button>
      </div>

      {/* Filters */}
      <div className="filters-container">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input type="text" placeholder="Rechercher par titre ou description..."
            value={filters.search}
            onChange={e => { setFilters({ ...filters, search: e.target.value }); setPagination(p => ({ ...p, currentPage: 1 })) }}
            className="search-input" />
          {filters.search && <button className="clear-search" onClick={() => setFilters({ ...filters, search: '' })}>×</button>}
        </div>
      </div>

      {filters.search && (
        <p style={{ margin: '0 0 12px', fontSize: '0.85rem', color: '#718096' }}>
          {filteredData.length} résultat{filteredData.length !== 1 ? 's' : ''} trouvé{filteredData.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Reports grid */}
      <div className="reports-grid">
        {paginatedData.map(r => (
          <div key={r.id} className="report-card">
            <div className="report-icon" style={{ background: '#4299e115', color: '#4299e1' }}>
              {r.tags?.includes('auto-generated') ? '📊' : '📄'}
            </div>
            <div className="report-info">
              <h4>{r.title}</h4>
              <p className="report-description">{r.description}</p>
              <p className="report-date">
                <span>Date : {formatDate(r.date)}</span>
                <span className="report-created">Créé le : {formatDateTime(r.createdAt)}</span>
              </p>
              {r.tags?.includes('auto-generated') && (
                <span style={{ fontSize: '11px', background: '#c6f6d5', color: '#276749', borderRadius: '10px', padding: '2px 8px', display: 'inline-block', marginTop: '4px' }}>
                  ⚡ Auto-généré
                </span>
              )}
            </div>
            <div className="report-actions">
              <button className="btn-icon" title="Voir" onClick={() => setViewReport(r)}>👁️</button>
              <button className="btn-icon" title="Télécharger PDF" onClick={() => handleReportDownload(r)}>PDF</button>
              <button className="btn-icon delete" title="Supprimer" onClick={() => openModal('delete', r)}>🗑️</button>
            </div>
          </div>
        ))}
      </div>

      {!filteredData.length && <NoResults onReset={resetFilters} />}
      <Pagination total={filteredData.length} pagination={pagination} setPagination={setPagination} />

      {/* ── Modals ── */}

      {showGenerateModal && (
        <GenerateReportModal
          onClose={() => setShowGenerateModal(false)}
          onGenerate={handleGenerate}
          loading={generatingReport}
        />
      )}

      {previewData && (
        <PreviewModal
          reportData={previewData}
          reportTitle={previewTitle}
          onClose={() => setPreviewData(null)}
          onSave={handleSaveReport}
          saving={savingReport}
        />
      )}

      {viewReport && (
        <ReportViewModal report={viewReport} onClose={() => setViewReport(null)} />
      )}

      

      {modal.isOpen && modal.mode === 'delete' && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content modal-small" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>⚠️ Confirmation</h3><button className="modal-close" onClick={closeModal}>×</button></div>
            <div className="modal-body">
              <p>Êtes-vous sûr de vouloir supprimer cet élément ?</p>
              <p className="text-danger">Cette action est irréversible.</p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeModal}>Annuler</button>
              <button className="btn-danger" onClick={handleDelete}>Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ReportsPage