import { useState, useEffect, useCallback } from 'react'
import productService from '../../../services/productService'
import supplierService from '../../../services/supplierService'
import notificationService from '../../../services/notificationService'
import './AlertsPage.css'
import {
  mapProductToUi,
  mapSupplierToUi,
  pickList,
} from '../../../utils/frontendApiAdapters'

function AlertsPage() {
  const [prod, setProd] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      const res = await notificationService.getAll();
      const data = res.data || (Array.isArray(res) ? res : []);
      // N-khalliw ken el notifications mta3 el stock
      setNotifications(data.filter(n => n.type === 'stock_faible' || n.type === 'produit_epuise'));
    } catch (err) {
      console.error("Erreur fetch notifications:", err);
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const productRes = await productService.getAll({ limit: 500 });
      setProd(pickList(productRes, ['products', 'data']).map(mapProductToUi));
      await fetchNotifications();
    } catch (error) {
      console.error('AlertsPage load error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData() }, [loadData]);

  const handleMarkAsRead = async (notifId) => {
    try {
      await notificationService.markAsRead(notifId);
      setNotifications(prev => prev.map(n => 
        (n._id === notifId) ? { ...n, read: true } : n
      ));
    } catch (err) {
      console.error("Erreur markAsRead:", err);
    }
  };

  if (loading) return <div className="loader">Chargement...</div>;

  // HNA EL FIX: N-branchiw el notification m3a el data mta3 el produit
  const alertsData = notifications.map(n => {
    const productDetail = prod.find(p => String(p.id) === String(n.data?.productId));
    return {
      ...n,
      productName: productDetail ? productDetail.name : "Produit Inconnu",
      currentStock: n.data?.stock
    };
  });

  const categories = [
    { title: "❌ Rupture de Stock ", key: "stock_faible", items: alertsData.filter(a => a.type === 'stock_faible') },
    { title: "⚠️ Zone Critique", key: "produit_epuise", items: alertsData.filter(a => a.type === 'produit_epuise') }
  ];

 
   return (
    <div className="page-content">
      <div className="page-header">
        <h2 className="page-title">⚠️ Alertes de Stock</h2>
        <p className="page-subtitle">Suivi en temps réel des produits en rupture ou seuil critique</p>
      </div>

      <div className="alerts-container">
        {categories.map(section => (
          <div key={section.key} className="alerts-section">
            <h3>{section.title}</h3>
            
            <div className="alerts-list">
              {section.items.length === 0 ? (
                <div className="no-alerts">
                  <p>Aucune alerte dans cette catégorie</p>
                </div>
              ) : (
                section.items.map(notif => (
                  <div 
                    key={notif._id} 
                    className={`alert-item ${notif.type === 'stock_faible' ? 'warning' : 'danger'}`}
                    style={{ opacity: notif.read ? 0.6 : 1 }}
                  >
                    <div className="alert-icon">
                      {notif.type === 'stock_faible' ? '❌' : '⚠️'}
                    </div>

                    <div className="alert-content">
                      <strong>{notif.productName}</strong>
                      <span>
                        Stock actuel: <b>{notif.currentStock}</b> units. 
                        <br />
                        <small>{new Date(notif.createdAt).toLocaleDateString()} à {new Date(notif.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</small>
                      </span>
                    </div>

                    <div className="alert-actions">
                      <button 
                        onClick={() => handleMarkAsRead(notif._id)}
                        disabled={notif.read}
                        className={notif.read ? "btn-read-icon" : "btn-action-icon"}
                        title={notif.read ? "Déjà lu" : "Marquer comme lu"}
                      >
                        {notif.read ? '✅' : '✔️'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )}
export default AlertsPage;