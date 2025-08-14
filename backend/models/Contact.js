const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
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

contactSchema.index({ companyId: 1 });
contactSchema.index({ email: 1 });
contactSchema.index({ phone: 1 });

module.exports = mongoose.model('Contact', contactSchema);
