const mongoose = require('mongoose');

const searchHistorySchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  },
  history: [
    {
      _id: false, // Disable auto _id for subdocuments — we use query as key
      query: { type: String, required: true },
      searched_at: { type: Date, default: Date.now },
    },
  ],
  updated_at: { type: Date, default: Date.now },
});

// Pre-save: enforce soft limit of 500 entries
searchHistorySchema.pre('save', function (next) {
  if (this.history && this.history.length > 500) {
    // Sort by searched_at DESC, keep newest 500
    this.history.sort((a, b) => new Date(b.searched_at) - new Date(a.searched_at));
    this.history = this.history.slice(0, 500);
  }
  this.updated_at = new Date();
  next();
});

const SearchHistory = mongoose.model('SearchHistory', searchHistorySchema);
module.exports = SearchHistory;
