const express = require('express');
const router = express.Router();
const {
  getAllDepenses,
  getDepenseById,
  createDepense,
  updateDepense,
  deleteDepense,
  getDepenseStats,
  getDepensesByCategory,
  getDepensesByStatus,
  updateOverdueStatus,
  markAsPaid,
  exportDepensesCSV
} = require('../controllers/depensesController');
const { protect } = require('../middleware/authMiddleware');
const { authorize, isAdminFinance, isAdminPrincipal } = require('../middleware/roleMiddleware');

// 📊 Routes publiques (accessibles sans authentification - optionnel)
// Si vous voulez que certaines routes soient publiques, gardez-les ici
// Sinon, appliquez protect à toutes les routes

// Routes protégées par authentification
router.use(protect); // Toutes les routes ci-dessous nécessitent une authentification

// 📈 Routes de consultation - Accessibles à tous les utilisateurs authentifiés
router.get('/', getAllDepenses);
router.get('/stats/summary', getDepenseStats);
router.get('/category/:category', getDepensesByCategory);
router.get('/status/:status', getDepensesByStatus);
router.get('/:id', getDepenseById);

// ✏️ Routes de modification - Réservées à la finance et admin principal
router.post('/', authorize('admin_finance', 'admin_principal'), createDepense);
router.put('/:id', authorize('admin_finance', 'admin_principal'), updateDepense);
router.delete('/:id', authorize('admin_finance', 'admin_principal'), deleteDepense);

// 🔄 Route spéciale pour mise à jour des statuts en retard
router.put('/update-overdue', authorize('admin_finance', 'admin_principal'), updateOverdueStatus);
router.patch('/:id/pay', authorize('admin_finance', 'admin_principal'), markAsPaid);
router.get('/export/csv', authorize('admin_finance', 'admin_principal'), exportDepensesCSV);
router.get('/stats/by-category', getDepenseStats);
router.get('/search', getAllDepenses);
module.exports = router;