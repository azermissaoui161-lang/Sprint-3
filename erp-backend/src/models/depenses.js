const mongoose = require('mongoose');

const depensesSchema = new mongoose.Schema({
  description: {
    type: String,
    required: [true, 'La description est requise'],
    trim: true,
    maxlength: [200, 'La description ne peut pas dépasser 200 caractères']
  },
  amount: {
    type: Number,
    required: [true, 'Le montant est requis'],
    min: [0.01, 'Le montant doit être supérieur à 0']
  },
  fournisseur: {
    type: String,
    trim: true,
    default: ''
  },
  category: {
    type: String,
    required: [true, 'La catégorie est requise'],
    enum: [
      'Achat',
      'Loyer',
      'Salaires',
      'Charges sociales',
      'Assurances',
      'Frais bancaires',
      'Fournitures',
      'Transport',
      'Marketing',
      'Services extérieurs',
      'Impôts',
      'Autre'
    ]
  },
  date: {
    type: String,
    required: [true, 'La date est requise']
  },
  dateEcheance: {
    type: String,
    default: ''
  },
  account: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    required: false // Optionnel ken l-user mazal ma khallas'hach
  },
  paymentMethod: {
    type: String,
    enum: ['Espèces', 'Virement', 'Chèque', 'Carte Bancaire', 'Autre'],
    default: 'Espèces'
  },
  status: {
    type: String,
    required: true,
    enum: ['payé', 'en attente', 'en retard'],
    default: 'en attente'
  },
  notes: {
    type: String,
    trim: true,
    default: '',
    maxlength: [500, 'Les notes ne peuvent pas dépasser 500 caractères']
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  createdBy: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: String,
    userRole: String
  },
  updatedBy: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: String,
    userRole: String,
    action: String,
    updatedAt: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual pour obtenir le montant absolu
depensesSchema.virtual('absoluteAmount').get(function() {
  return Math.abs(this.amount);
});

// Virtual pour le montant formaté (négatif pour les dépenses)
depensesSchema.virtual('formattedAmount').get(function() {
  return -Math.abs(this.amount);
});

// Middleware pre-save pour mettre à jour updatedAt
depensesSchema.pre('save', async function() {
  this.updatedAt = Date.now();
 
});

// Index pour améliorer les performances
depensesSchema.index({ userId: 1, createdAt: -1 });
depensesSchema.index({ status: 1, dateEcheance: 1 });
depensesSchema.index({ category: 1, date: -1 });

// Méthode statique pour obtenir les statistiques
depensesSchema.statics.getStats = async function(userId = null) {
  const matchQuery = userId ? { userId: mongoose.Types.ObjectId(userId) } : {};
  
  const stats = await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        total: { $sum: '$amount' }
      }
    }
  ]);
  
  const result = {
    totalDepenses: 0,
    paye: 0,
    enAttente: 0,
    enRetard: 0,
    totalPaye: 0,
    totalAttente: 0,
    totalRetard: 0
  };
  
  stats.forEach(stat => {
    if (stat._id === 'payé') {
      result.paye = stat.count;
      result.totalPaye = stat.total;
    } else if (stat._id === 'en attente') {
      result.enAttente = stat.count;
      result.totalAttente = stat.total;
    } else if (stat._id === 'en retard') {
      result.enRetard = stat.count;
      result.totalRetard = stat.total;
    }
    result.totalDepenses += stat.total;
  });
  
  return result;
};

// Méthode statique pour mettre à jour les statuts en retard
depensesSchema.statics.updateOverdueStatus = async function(userId = null) {
  const today = new Date().toISOString().split('T')[0];
  const query = {
    status: { $ne: 'payé' },
    dateEcheance: { $lt: today, $ne: '' }
  };
  
  if (userId) {
    query.userId = mongoose.Types.ObjectId(userId);
  }
  
  await this.updateMany(query, {
    $set: { status: 'en retard', updatedAt: Date.now() }
  });
};

const Depenses = mongoose.model('Depenses', depensesSchema);

module.exports = Depenses;