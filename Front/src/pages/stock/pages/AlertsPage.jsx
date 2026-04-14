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
  const [prod, setProd] = useState([])
  const [supp, setSupp] = useState([])
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  // 1. Fetch Notifications - Thabbet ennou el data jaya s7i7a
  const fetchNotifications = async () => {
    try {
      const res = await notificationService.getAll();
      const data = res.data || (Array.isArray(res) ? res : []);
      setNotifications(data);
    } catch (err) {
      console.error("Erreur fetch notifications:", err);
    }
  };

  // 2. Load Page Data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [productRes, supplierRes] = await Promise.all([
        productService.getAll({ limit: 500 }),
        supplierService.getAll({ limit: 500 }),
      ]);
      
      setProd(pickList(productRes, ['products', 'data']).map(mapProductToUi));
      setSupp(pickList(supplierRes, ['suppliers', 'data']).map(mapSupplierToUi));
      
      await fetchNotifications();
    } catch (error) {
      console.error('AlertsPage load error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData() }, [loadData]);

  // 3. Mark as Read in DB
  const handleMarkAsRead = async (notifId) => {
    try {
      await notificationService.markAsRead(notifId);
      await fetchNotifications(); // Recharger après modif
    } catch (err) {
      console.error("Erreur markAsRead:", err);
    }
  };

  if (loading) return <div className="loader">Chargement...</div>;

  // Logic categories
  const categories = [
    { title: "Stock faible", key: "faible", products: prod.filter(p => p.stock > 0 && p.stock < 5), icon: "⚠️", cls: "warning" },
    { title: "Rupture", key: "rupture", products: prod.filter(p => p.stock <= 0), icon: "❌", cls: "danger" }
  ];

  return (
    <div className="alerts-tab">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h2>⚠️ Alertes stock</h2>
        <button className="btn-small" onClick={loadData}>🔄 Synchroniser</button>
      </div>

      <div className="alerts-container">
        {categories.map(s => (
          <section key={s.key} className="alerts-section">
            <h3>{s.title} ({s.products.length})</h3>
            <div className="alerts-list">
              {s.products.length > 0 ? (
                s.products.map(p => {
                  // MATCHING LOGIC: On cherche la notification par productId ou par nom dans le message
                  const notif = notifications.find(n => 
                    (n.data && n.data.productId === p.id) || 
                    (n.message && n.message.includes(p.name))
                  );
                  
                  const isRead = notif ? notif.read : false;

                  return (
                    <article 
                      key={p.id} 
                      className={`alert-item ${s.cls} ${isRead ? 'alert-read' : ''}`}
                      style={isRead ? { opacity: 0.5 } : {}}
                    >
                      <div className="alert-icon">{s.icon}</div>
                      <div className="alert-content">
                        <strong>{p.name}</strong>
                        <span>Stock: {p.stock}</span>
                        <small>Fournisseur: {supp.find(sup => sup.id === p.supplierId)?.name || '-'}</small>
                      </div>

                      <div className="alert-actions">
                        {/* El bouton yarja3 lena */}
                        {notif ? (
                          <button 
                            className="btn-small" 
                            style={{ 
                              background: isRead ? '#718096' : '#48bb78', 
                              color: 'white', 
                              cursor: isRead ? 'default' : 'pointer' 
                            }}
                            onClick={() => !isRead && handleMarkAsRead(notif._id || notif.id)}
                            disabled={isRead}
                          >
                            {isRead ? 'Lu ✅' : 'Marquer Lu'}
                          </button>
                        ) : (
                          /* Ken mafamech Notif fel BD, n-affichiw bouton manuel bech n-creyiw wa7da (optionnel) */
                          <span style={{ fontSize: '10px', color: '#a0aec0' }}>Non synchronisé</span>
                        )}
                      </div>
                    </article>
                  );
                })
              ) : (
                <p className="no-alerts">Aucun produit</p>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export default AlertsPage;