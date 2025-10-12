const mongoose = require('mongoose');

const authIdentitySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  provider: { type: String, required: true, enum: ['google'] },
  providerUserId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

authIdentitySchema.index({ provider: 1, providerUserId: 1 }, { unique: true });

module.exports = mongoose.model('AuthIdentity', authIdentitySchema);



