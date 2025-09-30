const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Comment = require('../models/Comment');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Middleware to validate request
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// GET /api/comments/:movieId/:type - Lấy tất cả comments của một movie/tvshow
router.get('/:movieId/:type', async (req, res) => {
  try {
    const { movieId, type } = req.params;
    const { sortBy = 'newest' } = req.query;
    const userId = req.user; // From auth middleware if authenticated

    if (!movieId || !type) {
      return res.status(400).json({ message: 'Movie ID and type are required' });
    }

    if (!['movie', 'tvshow'].includes(type)) {
      return res.status(400).json({ message: 'Type must be either movie or tvshow' });
    }

    let comments = await Comment.getCommentsWithUserInfo(movieId, type, userId);

    // Sort comments based on sortBy parameter
    switch (sortBy) {
      case 'oldest':
        comments = comments.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        break;
      case 'popular':
        comments = comments.sort((a, b) => b.likes - a.likes);
        break;
      case 'newest':
      default:
        comments = comments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
    }

    res.json({
      success: true,
      data: comments,
      total: comments.length
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/comments - Tạo comment mới
router.post('/', [
  auth,
  body('movieId').isNumeric().withMessage('Movie ID must be a number'),
  body('type').isIn(['movie', 'tvshow']).withMessage('Type must be movie or tvshow'),
  body('content').isLength({ min: 1, max: 500 }).withMessage('Content must be between 1 and 500 characters'),
  body('parentId').optional().isMongoId().withMessage('Parent ID must be a valid MongoDB ObjectId')
], validateRequest, async (req, res) => {
  try {
    const { movieId, type, content, parentId } = req.body;
    const userId = req.user;

    // Get user info
    const user = await User.findById(userId).select('name email avatar');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // If it's a reply, check if parent comment exists
    if (parentId) {
      const parentComment = await Comment.findById(parentId);
      if (!parentComment) {
        return res.status(404).json({ message: 'Parent comment not found' });
      }
    }

    const comment = new Comment({
      movieId: parseInt(movieId),
      type,
      userId,
      username: user.name,
      avatar: user.avatar || '',
      content: content.trim(),
      parentId: parentId || null
    });

    await comment.save();

    // If it's a reply, add to parent's replies array
    if (parentId) {
      await Comment.findByIdAndUpdate(parentId, {
        $push: { replies: comment._id }
      });
    }

    // Populate user info for response
    const populatedComment = await Comment.findById(comment._id)
      .populate('userId', 'name email avatar')
      .lean();

    res.status(201).json({
      success: true,
      message: 'Comment created successfully',
      data: {
        ...populatedComment,
        isLiked: false,
        likedBy: undefined
      }
    });
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/comments/:id/like - Toggle like cho comment
router.put('/:id/like', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user;

    const comment = await Comment.findById(id);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    await comment.toggleLike(userId);

    const updatedComment = await Comment.findById(id)
      .populate('userId', 'name email avatar')
      .lean();

    res.json({
      success: true,
      message: 'Like toggled successfully',
      data: {
        ...updatedComment,
        isLiked: updatedComment.likedBy.some(id => id.equals(userId)),
        likedBy: undefined
      }
    });
  } catch (error) {
    console.error('Toggle like error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/comments/:id - Cập nhật nội dung comment
router.put(
  '/:id',
  [
    auth,
    body('content')
      .isLength({ min: 1, max: 500 })
      .withMessage('Content must be between 1 and 500 characters'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { content } = req.body;
      const userId = req.user;

      const comment = await Comment.findById(id);
      if (!comment) {
        return res.status(404).json({ message: 'Comment not found' });
      }

      // Chỉ chủ sở hữu mới được sửa
      if (!comment.userId.equals(userId)) {
        return res
          .status(403)
          .json({ message: 'You can only edit your own comments' });
      }

      comment.content = content.trim();
      await comment.save();

      const updated = await Comment.findById(id)
        .populate('userId', 'name email avatar')
        .lean();

      res.json({
        success: true,
        message: 'Comment updated successfully',
        data: {
          ...updated,
          likedBy: undefined,
        },
      });
    } catch (error) {
      console.error('Update comment error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// DELETE /api/comments/:id - Xóa comment (soft delete)
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user;

    const comment = await Comment.findById(id);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if user owns the comment
    if (!comment.userId.equals(userId)) {
      return res.status(403).json({ message: 'You can only delete your own comments' });
    }

    // HARD DELETE with simple cascading for replies
    if (!comment.parentId) {
      // Delete all replies of this top-level comment
      await Comment.deleteMany({ parentId: id });
    } else {
      // Pull this reply reference out of parent.replies
      await Comment.findByIdAndUpdate(comment.parentId, { $pull: { replies: comment._id } });
    }

    await Comment.deleteOne({ _id: id });

    res.json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/comments/:id/replies - Lấy replies của một comment
router.get('/:id/replies', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user; // From auth middleware if authenticated

    const replies = await Comment.find({ 
      parentId: id, 
      isDeleted: false 
    })
    .populate('userId', 'name email avatar')
    .sort({ createdAt: 1 })
    .lean();

    const processedReplies = replies.map(reply => ({
      ...reply,
      isLiked: userId ? reply.likedBy.some(id => id.equals(userId)) : false,
      likedBy: undefined
    }));

    res.json({
      success: true,
      data: processedReplies
    });
  } catch (error) {
    console.error('Get replies error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
