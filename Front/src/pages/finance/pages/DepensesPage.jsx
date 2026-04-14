import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import './depenses.css'
// 1. Import el service el jdid
import { depensesService } from '../../../services/depensesService' 
import { accountService } from '../../../services/accountService'
import {
  extractApiErrorMessage,
  mapAccountToUi,
  pickList,
} from '../../../utils/frontendApiAdapters'

const COLORS = {
  success: '#48bb78',
  warning: '#ed8936',
  danger: '#f56565',
  muted: '#718096',
  successBg: '#c6f6d5',
  warningBg: '#feebc8',
  dangerBg: '#fed7d7',
  mutedBg: '#edf2f7',
  defaultBg: '#e2e8f0',
}

const STATUS_CONFIG = {
  payé: { color: COLORS.success, bg: COLORS.successBg },
  'en attente': { color: COLORS.warning, bg: COLORS.warningBg },
  'en retard': { color: COLORS.danger, bg: COLORS.dangerBg },
}

const getStatusStyle = (status) =>
  STATUS_CONFIG[status] || { color: COLORS.muted, bg: COLORS.defaultBg }

const StatusBadge = ({ status }) => {
  const style = getStatusStyle(status)
  return (
    <span className="status-badge" style={{ background: style.bg, color: style.color }}>
      {status}
    </span>
  )
}

const FORMAT_OPTIONS = {
  currency: { style: 'currency', currency: 'EUR' },
  date: { day: '2-digit', month: '2-digit', year: 'numeric' },
}

const today = new Date().toISOString().split('T')[0]

const EMPTY_DEPENSE = {
  description: '',
  amount: '',
  fournisseur: '',
  category: 'Achat',
  date: today,
  dateEcheance: '',
  status: 'en attente',
  notes: '',
}

const DEPENSE_CATEGORIES = [
  'Achat',
  'Loyer',
  'Salaires',
  'Charges sociales',
  'Assurances',
  'Fournitures',
  'Transport',
  'Marketing',
  'Services extérieurs',
  'Impôts',
  'Autre',
]

const NoResults = ({ onReset }) => (
  <div className="no-results">
    <p>Aucune dépense trouvée</p>
    <button className="btn-reset" onClick={onReset}>
      Réinitialiser
    </button>
  </div>
)

const Pagination = ({ total, pagination, setPagination }) => {
  const totalPages = Math.ceil(total / pagination.itemsPerPage)
  const start = total > 0 ? (pagination.currentPage - 1) * pagination.itemsPerPage + 1 : 0
  const end = Math.min(pagination.currentPage * pagination.itemsPerPage, total)

  return (
    <div className="pagination">
      <span className="pagination-info">
        {total > 0 ? `${start}-${end} sur ${total}` : '0 élément'}
      </span>
      <div className="pagination-controls">
        <button
          className="pagination-btn"
          onClick={() =>
            setPagination((p) => ({
              ...p,
              currentPage: Math.max(1, p.currentPage - 1),
            }))
          }
          disabled={pagination.currentPage === 1}
        >
          ←
        </button>
        {[...Array(totalPages)].map((_, i) => {
          const page = i + 1
          const show =
            page === 1 ||
            page === totalPages ||
            (page >= pagination.currentPage - 2 && page <= pagination.currentPage + 2)
          if (show)
            return (
              <button
                key={page}
                className={`pagination-btn ${pagination.currentPage === page ? 'active' : ''}`}
                onClick={() => setPagination((p) => ({ ...p, currentPage: page }))}
              >
                {page}
              </button>
            )
          if (page === pagination.currentPage - 3 || page === pagination.currentPage + 3)
            return <span key={page} className="pagination-dots">...</span>
          return null
        })}
        <button
          className="pagination-btn"
          onClick={() =>
            setPagination((p) => ({
              ...p,
              currentPage: Math.min(totalPages, p.currentPage + 1),
            }))
          }
          disabled={pagination.currentPage === totalPages || total === 0}
        >
          →
        </button>
      </div>
      <select
        className="pagination-limit"
        value={pagination.itemsPerPage}
        onChange={(e) =>
          setPagination({ currentPage: 1, itemsPerPage: Number(e.target.value) })
        }
      >
        {[10, 25, 50, 100].map((v) => (
          <option key={v} value={v}>
            {v} par page
          </option>
        ))}
      </select>
    </div>
  )
}

const DepenseForm = ({ formData, setFormData }) => {
  const fd = formData
  const set = (field, value) => setFormData({ ...fd, [field]: value })
    const [accounts, setAccounts] = useState([])
  const [filters, setFilters] = useState({ search: '', type: 'tous', status: 'tous' })
  const loadData = async () => {
      try {
        const res = await accountService.getAll({ limit: 200 })
        setAccounts(pickList(res, ['data']).map(mapAccountToUi))
      } catch (error) {
        notify(extractApiErrorMessage(error, 'Impossible de charger les comptes'), 'error')
      } finally {
        setLoading(false)
      }
    }
  
    useEffect(() => { loadData() }, [])

  return (
    <>
      <div className="form-group">
        <label>Description *</label>
        <input
          type="text"
          value={fd.description}
          onChange={(e) => set('description', e.target.value)}
          required
          placeholder="Ex: Achat fournitures bureau"
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Montant *</label>
          <input
            type="number"
            value={fd.amount}
            onChange={(e) => set('amount', e.target.value)}
            step="0.01"
            required
            placeholder="0.00"
          />
        </div>
        <div className="form-group">
          <label>Fournisseur</label>
          <input
            type="text"
            value={fd.fournisseur}
            onChange={(e) => set('fournisseur', e.target.value)}
            placeholder="Nom du fournisseur"
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Catégorie *</label>
          <select value={fd.category} onChange={(e) => set('category', e.target.value)}>
            {DEPENSE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Statut *</label>
          <select value={fd.status} onChange={(e) => set('status', e.target.value)}>
            <option value="payé">Payé</option>
            <option value="en attente">En attente</option>
            <option value="en retard">En retard</option>
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
<div className="form-group">
  <label>Compte de paiement *</label>
  <select 
    className="filter-select" 
    value={fd.account || ''} 
    onChange={e => set('account', e.target.value)}
    required
  >
    <option value="" disabled>-- Sélectionnez un compte --</option>
    {accounts.map(acc => (
      <option key={acc.id} value={acc.id}>{acc.name}</option>
    ))}
  </select>
</div>
          <br /><br />
          <label>Date de la dépense *</label>
          <input
            type="date"
            value={fd.date ? fd.date.split('T')[0] : ''}
            onChange={(e) => set('date', e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Date d'échéance</label>
          <input
            type="date"
            value={fd.dateEcheance ? fd.dateEcheance.split('T')[0] : ''}
            onChange={(e) => set('dateEcheance', e.target.value)}
          />
        </div>
      </div>

      <div className="form-group">
        <label>Notes / Référence</label>
        <textarea
          value={fd.notes}
          onChange={(e) => set('notes', e.target.value)}
          rows="3"
          placeholder="Informations complémentaires, numéro de facture..."
        />
      </div>
    </>
  )
}

// 2. Na7ina el storageService w badalnah b'khedma direct m3a el API mte3ek
function DepensesPage({ showNotif }) {
  const navigate = useNavigate()
  const notify = (msg, type) => {
    if (typeof showNotif === 'function') showNotif(msg, type)
    else if (type === 'error') window.alert(msg)
    else console.log(msg)
  }

  const [depenses, setDepenses] = useState([])
  const [filters, setFilters] = useState({
    search: '',
    status: 'tous',
    category: 'tous',
    dateRange: { start: '', end: '' },
    montantMin: '',
    montantMax: '',
  })
  const [pagination, setPagination] = useState({ currentPage: 1, itemsPerPage: 10 })
  const [sort, setSort] = useState({ key: 'date', direction: 'desc' })
  const [modal, setModal] = useState({ isOpen: false, mode: 'add', item: null })
  const [formData, setFormData] = useState({ ...EMPTY_DEPENSE })
  const [loading, setLoading] = useState(true)

  const formatCurrency = (amount) =>
    (amount || 0).toLocaleString('fr-FR', FORMAT_OPTIONS.currency)
  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('fr-FR', FORMAT_OPTIONS.date) : ''

  // 3. Modification loadData pour utiliser depensesService.getAll()
  const loadData = async () => {
    try {
      setLoading(true)
      const response = await depensesService.getAll()
      // MongoDB yestaamel _id, donc lezemna nmapiw el id lel front
      const formatted = (response.data || []).map(d => ({
        ...d,
        id: d._id, 
        amount: -Math.abs(d.amount) // Garder le signe négatif pour l'affichage
      }))
      setDepenses(formatted)
    } catch (error) {
      notify('Impossible de charger les données du serveur', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const resetFilters = () => {
    setFilters({
      search: '',
      status: 'tous',
      category: 'tous',
      dateRange: { start: '', end: '' },
      montantMin: '',
      montantMax: '',
    })
    setPagination((p) => ({ ...p, currentPage: 1 }))
  }

  const filteredData = useMemo(() => {
    return depenses.filter((item) => {
      if (filters.search) {
        const s = filters.search.toLowerCase()
        if (
          ![
            item.description,
            item.id,
            item.fournisseur,
            item.category,
          ].some((f) => f?.toLowerCase().includes(s))
        )
          return false
      }
      if (filters.status !== 'tous' && item.status !== filters.status) return false
      if (filters.category !== 'tous' && item.category !== filters.category) return false
      if (filters.dateRange.start && item.date && item.date < filters.dateRange.start)
        return false
      if (filters.dateRange.end && item.date && item.date > filters.dateRange.end)
        return false
      if (filters.montantMin && (Math.abs(item.amount) || 0) < parseFloat(filters.montantMin))
        return false
      if (filters.montantMax && (Math.abs(item.amount) || 0) > parseFloat(filters.montantMax))
        return false
      return true
    })
  }, [depenses, filters])

  const stats = useMemo(() => {
    const total = filteredData.length
    const paye = filteredData.filter((d) => d.status === 'payé').length
    const attente = filteredData.filter((d) => d.status === 'en attente').length
    const retard = filteredData.filter((d) => d.status === 'en retard').length
    const montantTotal = filteredData.reduce((sum, d) => sum + Math.abs(d.amount || 0), 0)
    return { totalDepenses: montantTotal, totalPaye: paye, totalAttente: attente, totalRetard: retard }
  }, [filteredData])

  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      let valA = a[sort.key]
      let valB = b[sort.key]
      if (['date', 'dateEcheance', 'createdAt'].includes(sort.key)) {
        valA = new Date(valA || 0)
        valB = new Date(valB || 0)
      }
      if (['amount'].includes(sort.key)) {
        valA = Math.abs(Number(valA)) || 0
        valB = Math.abs(Number(valB)) || 0
      }
      return valA < valB
        ? sort.direction === 'asc'
          ? -1
          : 1
        : valA > valB
        ? sort.direction === 'asc'
          ? 1
          : -1
        : 0
    })
  }, [filteredData, sort])
  

  const paginatedData = sortedData.slice(
    (pagination.currentPage - 1) * pagination.itemsPerPage,
    pagination.currentPage * pagination.itemsPerPage
  )

  const openModal = (mode, item = null) => {
    if (item && mode === 'edit') {
      setFormData({
        ...item,
        amount: Math.abs(item.amount || 0).toString(),
        fournisseur: item.fournisseur || '',
        dateEcheance: item.dateEcheance || '',
      })
    } else {
      setFormData({ ...EMPTY_DEPENSE })
    }
    setModal({ isOpen: true, mode, item })
  }

  const closeModal = () => {
    setModal({ isOpen: false, mode: 'add', item: null })
    setFormData({ ...EMPTY_DEPENSE })
  }

  // 4. Utilisation de depensesService.create()
  const handleAdd = async () => {
    try {
      const dataToSave = {
        ...formData,
        amount: Math.abs(parseFloat(formData.amount)) // Le backend gère le stockage
      }
      
      await depensesService.create(dataToSave)
      await loadData()
      closeModal()
      notify('Dépense ajoutée avec succès')
    } catch (error) {
      notify(error.response?.data?.message || "Erreur lors de l'ajout", 'error')
    }
  }

  // 5. Utilisation de depensesService.update()
  const handleUpdate = async () => {
    try {
      const targetId = modal.item?.id // C'est l'ID de MongoDB (_id)
      const dataToUpdate = {
        ...formData,
        amount: Math.abs(parseFloat(formData.amount))
      }

      await depensesService.update(targetId, dataToUpdate)
      await loadData()
      closeModal()
      notify('Dépense modifiée avec succès')
    } catch (error) {
      notify(error.response?.data?.message || 'Erreur lors de la modification', 'error')
    }
  }

  // 6. Utilisation de depensesService.delete()
  const handleDelete = async () => {
    try {
      const targetId = modal.item?.id
      await depensesService.delete(targetId)
      await loadData()
      closeModal()
      notify('Dépense supprimée')
    } catch (error) {
      notify(error.response?.data?.message || 'Erreur lors de la suppression', 'error')
    }
  }

  // 7. Utilisation de depensesService.exportToCSV()
  const handleExport = async () => {
    try {
      await depensesService.exportToCSV()
      notify('Export CSV effectué')
    } catch (error) {
      notify("Erreur lors de l'export", 'error')
    }
  }

  if (loading)
    return (
      <div className="finance-loading">
        <div className="spinner"></div>
        <p>Chargement des dépenses...</p>
      </div>
    )

  return (
    <div className="depenses-content">
      <div className="depenses-stats">
        <div className="stat-card">
          <span className="stat-label">Total dépenses</span>
          <span className="stat-value">{formatCurrency(stats.totalDepenses)}</span>
        </div>
        <div className="stat-card success">
          <span className="stat-label">Payé</span>
          <span className="stat-value">{stats.totalPaye}</span>
        </div>
        <div className="stat-card warning">
          <span className="stat-label">En attente</span>
          <span className="stat-value">{stats.totalAttente}</span>
        </div>
        <div className="stat-card danger">
          <span className="stat-label">En retard</span>
          <span className="stat-value">{stats.totalRetard}</span>
        </div>
      </div>

      <div className="depenses-actions">
        <button className="btn-primary" onClick={() => openModal('add')}>
          + Nouvelle dépense
        </button>
        <button className="btn-export" onClick={handleExport}>
          📥 Exporter CSV
        </button>
      </div>

      <div className="filters-container">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Rechercher par description, fournisseur..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="search-input"
          />
          {filters.search && (
            <button
              className="clear-search"
              onClick={() => setFilters({ ...filters, search: '' })}
            >
              ×
            </button>
          )}
        </div>
        <div className="filter-group">
          <select
            className="filter-select"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="tous">Tous statuts</option>
            <option value="payé">Payé</option>
            <option value="en attente">En attente</option>
            <option value="en retard">En retard</option>
          </select>
          <select
            className="filter-select"
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
          >
            <option value="tous">Toutes catégories</option>
            {DEPENSE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <button className="btn-reset-filters" onClick={resetFilters}>
            ↻ Réinitialiser
          </button>
        </div>
      </div>

      <div className="table-container">
        <table className="depenses-full-table">
          <thead>
            <tr>
              <th onClick={() => setSort({ key: 'id', direction: sort.direction === 'asc' ? 'desc' : 'asc' })}>
                N° {sort.key === 'id' && (sort.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => setSort({ key: 'date', direction: sort.direction === 'asc' ? 'desc' : 'asc' })}>
                Date {sort.key === 'date' && (sort.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => setSort({ key: 'dateEcheance', direction: sort.direction === 'asc' ? 'desc' : 'asc' })}>
                Échéance {sort.key === 'dateEcheance' && (sort.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th>Description</th>
              <th>Fournisseur</th>
              <th>Catégorie</th>
              <th onClick={() => setSort({ key: 'amount', direction: sort.direction === 'asc' ? 'desc' : 'asc' })}>
                Montant {sort.key === 'amount' && (sort.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((d) => (
              <tr key={d.id} className={d.status === 'en retard' ? 'row-overdue' : ''}>
                <td className="depense-number" title={d.id}>...{d.id.slice(-5)}</td>
                <td>{formatDate(d.date)}</td>
                <td className={d.dateEcheance && new Date(d.dateEcheance) < new Date() && d.status !== 'payé' ? 'date-overdue' : ''}>
                  {formatDate(d.dateEcheance) || '-'}
                </td>
                <td className="depense-desc">
                  {d.description}
                  {d.notes && <small className="notes-indicator">📝</small>}
                </td>
                <td>{d.fournisseur || '-'}</td>
                <td>
                  <span className="category-badge">{d.category}</span>
                </td>
                <td className="text-danger">
                  <strong>-{formatCurrency(Math.abs(d.amount))}</strong>
                </td>
                <td>
                  <StatusBadge status={d.status} />
                </td>
                <td>
                  <div className="action-buttons">
                    <button className="action-btn" onClick={() => openModal('edit', d)}>
                      ✏️
                    </button>
                    <button
                      className="action-btn delete"
                      onClick={() => openModal('delete', d)}
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filteredData.length && <NoResults onReset={resetFilters} />}
      </div>

      <Pagination total={filteredData.length} pagination={pagination} setPagination={setPagination} />

      {modal.isOpen && modal.mode !== 'delete' && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content modal-depense" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {modal.mode === 'add'
                  ? '➕ Nouvelle dépense'
                  : '✏️ Modifier la dépense'}
              </h3>
              <button className="modal-close" onClick={closeModal}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <DepenseForm
                formData={formData}
                setFormData={setFormData}
              />
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeModal}>
                Annuler
              </button>
              <button
                className="btn-primary"
                style={{ background: '#4299e1' }}
                onClick={modal.mode === 'add' ? handleAdd : handleUpdate}
              >
                {modal.mode === 'add' ? 'Ajouter' : 'Modifier'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal.isOpen && modal.mode === 'delete' && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>⚠️ Confirmation</h3>
              <button className="modal-close" onClick={closeModal}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>Êtes-vous sûr de vouloir supprimer cette dépense ?</p>
              <p className="text-danger">Cette action est irréversible.</p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeModal}>
                Annuler
              </button>
              <button className="btn-danger" onClick={handleDelete}>
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DepensesPage;