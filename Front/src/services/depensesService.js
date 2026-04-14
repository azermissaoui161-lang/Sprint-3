// src/services/depensesService.js
import api from './api';

export const depensesService = {
  // ===== CRUD STANDARD =====
  /**
   * Récupérer toutes les dépenses
   * @param {Object} params - Paramètres (search, status, category, dateRangeStart, dateRangeEnd, montantMin, montantMax)
   * @returns {Promise<Object>} Liste des dépenses
   */
  getAll: async (params = {}) => {
    try {
      const response = await api.get('/depenses', { params });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur getAll depenses:', error);
      throw error;
    }
  },

  /**
   * Récupérer une dépense par ID
   * @param {string} id - ID de la dépense
   * @returns {Promise<Object>} Détails de la dépense
   */
  getById: async (id) => {
    try {
      if (!id) {
        throw new Error('ID de la dépense requis');
      }
      const response = await api.get(`/depenses/${id}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur getById depense ${id}:`, error);
      throw error;
    }
  },

  /**
   * Créer une dépense
   * @param {Object} depenseData - Données de la dépense
   * @returns {Promise<Object>} Dépense créée
   */
  create: async (depenseData) => {
    try {
      // Validation des données
      if (!depenseData || typeof depenseData !== 'object') {
        throw new Error('Données de la dépense invalides');
      }
      
      if (!depenseData.description?.trim()) {
        throw new Error('La description est requise');
      }
      
      if (!depenseData.amount || depenseData.amount <= 0) {
        throw new Error('Le montant doit être supérieur à 0');
      }
      
      if (!depenseData.category) {
        throw new Error('La catégorie est requise');
      }
      
      if (!depenseData.date) {
        throw new Error('La date est requise');
      }
      
      const response = await api.post('/depenses', depenseData);
      return response.data;
    } catch (error) {
      console.error('❌ Erreur create depense:', error);
      throw error;
    }
  },

  /**
   * Mettre à jour une dépense
   * @param {string} id - ID de la dépense
   * @param {Object} depenseData - Nouvelles données
   * @returns {Promise<Object>} Dépense mise à jour
   */
  update: async (id, depenseData) => {
    try {
      if (!id) {
        throw new Error('ID de la dépense requis');
      }
      
      if (!depenseData || typeof depenseData !== 'object') {
        throw new Error('Données de la dépense invalides');
      }
      
      const response = await api.put(`/depenses/${id}`, depenseData);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur update depense ${id}:`, error);
      throw error;
    }
  },

  /**
   * Supprimer une dépense
   * @param {string} id - ID de la dépense
   * @returns {Promise<Object>} Confirmation de suppression
   */
  delete: async (id) => {
    try {
      if (!id) {
        throw new Error('ID de la dépense requis');
      }
      const response = await api.delete(`/depenses/${id}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur delete depense ${id}:`, error);
      throw error;
    }
  },

  // ===== ACTIONS SUR DÉPENSES =====
  /**
   * Marquer une dépense comme payée
   * @param {string} id - ID de la dépense
   * @param {Object} paymentData - Données du paiement
   * @returns {Promise<Object>} Dépense mise à jour
   */
  markAsPaid: async (id, paymentData) => {
    try {
      if (!id) {
        throw new Error('ID de la dépense requis');
      }
      
      if (!paymentData?.paymentMethod) {
        throw new Error('Le mode de paiement est requis');
      }
      
      const response = await api.patch(`/depenses/${id}/pay`, paymentData);
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur markAsPaid depense ${id}:`, error);
      throw error;
    }
  },

  /**
   * Changer le statut d'une dépense
   * @param {string} id - ID de la dépense
   * @param {string} status - Nouveau statut (payé, en attente, en retard)
   * @returns {Promise<Object>} Dépense mise à jour
   */
  changeStatus: async (id, status) => {
    try {
      if (!id) {
        throw new Error('ID de la dépense requis');
      }
      
      if (!status || !['payé', 'en attente', 'en retard'].includes(status)) {
        throw new Error('Statut invalide');
      }
      
      const response = await api.patch(`/depenses/${id}/status`, { status });
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur changeStatus depense ${id}:`, error);
      throw error;
    }
  },

  // ===== STATISTIQUES =====
  /**
   * Obtenir les statistiques des dépenses
   * @param {Object} params - Paramètres (startDate, endDate, category)
   * @returns {Promise<Object>} Statistiques
   */
  getStats: async (params = {}) => {
    try {
      const response = await api.get('/depenses/stats', { params });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur getStats depenses:', error);
      throw error;
    }
  },

  /**
   * Obtenir le total des dépenses par catégorie
   * @param {Object} params - Paramètres (startDate, endDate)
   * @returns {Promise<Object>} Totaux par catégorie
   */
  getTotalByCategory: async (params = {}) => {
    try {
      const response = await api.get('/depenses/stats/by-category', { params });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur getTotalByCategory depenses:', error);
      throw error;
    }
  },

  /**
   * Obtenir les dépenses en retard
   * @returns {Promise<Object>} Liste des dépenses en retard
   */
  getOverdue: async () => {
    try {
      const response = await api.get('/depenses/overdue');
      return response.data;
    } catch (error) {
      console.error('❌ Erreur getOverdue depenses:', error);
      throw error;
    }
  },

  // ===== EXPORTS =====
  /**
   * Exporter les dépenses en CSV
   * @param {Object} params - Paramètres (startDate, endDate, category, status)
   * @returns {Promise<boolean>} Succès de l'export
   */
  exportToCSV: async (params = {}) => {
    try {
      const response = await api.get('/depenses/export/csv', {
        params,
        responseType: 'blob',
        timeout: 30000
      });
      
      // Créer un lien de téléchargement
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `depenses-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      
      // Nettoyer
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 200);
      
      return true;
    } catch (error) {
      console.error('❌ Erreur exportToCSV depenses:', error);
      throw error;
    }
  },

  // ===== RECHERCHE =====
  /**
   * Recherche avancée de dépenses
   * @param {Object} params - Critères de recherche
   * @param {string} params.q - Terme de recherche
   * @param {string} params.category - Catégorie
   * @param {string} params.status - Statut
   * @param {number} params.minAmount - Montant minimum
   * @param {number} params.maxAmount - Montant maximum
   * @param {string} params.startDate - Date début
   * @param {string} params.endDate - Date fin
   * @param {string} params.fournisseur - Fournisseur
   * @returns {Promise<Object>} Résultats de recherche
   */
  search: async (params) => {
    try {
      const response = await api.get('/depenses/search', { params });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur search depenses:', error);
      throw error;
    }
  }
};