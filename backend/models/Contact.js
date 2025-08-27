const mongoose = require('mongoose');
const { tenantScopePlugin } = require('../plugins/tenantScopePlugin');

const contactSchema = new mongoose.Schema({
  // Multi-tenant: referência ao tenant (empresa)
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
    // index criado automaticamente pelo plugin
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    sparse: true,
  },
  phone: {
    type: String,
    sparse: true,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Índices compostos para garantir unicidade por tenant
contactSchema.index({ tenantId: 1, email: 1 }, { unique: true, sparse: true });
contactSchema.index({ tenantId: 1, phone: 1 }, { unique: true, sparse: true });
contactSchema.index({ companyId: 1 });


// Aplicar plugin de tenant scope
contactSchema.plugin(tenantScopePlugin);

module.exports = mongoose.model('Contact', contactSchema);
