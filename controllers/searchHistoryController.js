const SearchHistory = require('../models/SearchHistory');

/**
 * GET /api/search-history
 * Trả về toàn bộ lịch sử tìm kiếm của user (sorted DESC, max 500)
 */
const getHistory = async (req, res) => {
  try {
    const doc = await SearchHistory.findOne({ user_id: req.user }).lean();
    if (!doc) {
      return res.json({ history: [] });
    }
    // Sort DESC by searched_at
    const sorted = (doc.history || []).sort(
      (a, b) => new Date(b.searched_at) - new Date(a.searched_at)
    );
    res.json({ history: sorted });
  } catch (e) {
    console.error('search-history GET error:', e);
    res.status(500).json({ code: 'GET_FAILED', message: 'Failed to fetch search history' });
  }
};

/**
 * POST /api/search-history
 * Body: { history: [{ query: String, searched_at: ISODate }] }
 * Upsert toàn bộ mảng lịch sử — server normalize, deduplicate, trim to 500
 */
const syncHistory = async (req, res) => {
  try {
    const { history } = req.body || {};
    if (!Array.isArray(history)) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'history must be an array' });
    }

    // Server-side normalize + deduplicate (keep latest searched_at per query)
    const map = new Map();
    for (const entry of history) {
      if (!entry.query || typeof entry.query !== 'string') continue;
      const normalized = entry.query.toLowerCase().trim();
      if (!normalized) continue;

      const searchedAt = entry.searched_at ? new Date(entry.searched_at) : new Date();
      // Validate date
      if (isNaN(searchedAt.getTime())) continue;

      const existing = map.get(normalized);
      if (!existing || searchedAt > existing.searched_at) {
        map.set(normalized, { query: normalized, searched_at: searchedAt });
      }
    }

    // Convert to array, sort DESC, trim to 500
    let cleaned = Array.from(map.values())
      .sort((a, b) => new Date(b.searched_at) - new Date(a.searched_at))
      .slice(0, 500);

    await SearchHistory.findOneAndUpdate(
      { user_id: req.user },
      {
        $set: {
          history: cleaned,
          updated_at: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    res.json({ ok: true, count: cleaned.length });
  } catch (e) {
    console.error('search-history POST error:', e);
    res.status(500).json({ code: 'SYNC_FAILED', message: 'Failed to sync search history' });
  }
};

/**
 * DELETE /api/search-history
 * Xóa toàn bộ lịch sử tìm kiếm của user
 */
const clearHistory = async (req, res) => {
  try {
    await SearchHistory.findOneAndUpdate(
      { user_id: req.user },
      { $set: { history: [], updated_at: new Date() } },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('search-history DELETE error:', e);
    res.status(500).json({ code: 'CLEAR_FAILED', message: 'Failed to clear search history' });
  }
};

module.exports = { getHistory, syncHistory, clearHistory };
