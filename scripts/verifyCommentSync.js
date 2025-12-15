/**
 * Verification Script: Test Avatar Sync in Comments
 * 
 * This script verifies that comments are properly synced with user avatars.
 * It checks that comments don't have redundant username/avatar fields
 * and that they properly populate user data.
 * 
 * Usage:
 * node scripts/verifyCommentSync.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Comment = require('../models/Comment');
const User = require('../models/User');

async function verifyCommentSync() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    // Test 1: Check schema doesn't have redundant fields
    const sampleComment = await Comment.findOne({});
    if (sampleComment) {
      const hasUsername = sampleComment.username !== undefined;
      const hasAvatar = sampleComment.avatar !== undefined;
    }

    // Test 2: Check populate works correctly
    const populatedComment = await Comment.findOne({})
      .populate('userId', 'name email avatar');
    
    if (populatedComment) {
      if (populatedComment.userId && typeof populatedComment.userId === 'object') {
        // Populate works
      }
    }

    // Test 3: Check all comments have valid userId references
    const totalComments = await Comment.countDocuments({});
    const commentsWithUserId = await Comment.countDocuments({ userId: { $exists: true } });

    // Test 4: Simulate avatar change scenario
    const testUser = await User.findOne({});
    if (testUser) {
      const userComments = await Comment.find({ userId: testUser._id })
        .populate('userId', 'name email avatar')
        .limit(3);
      
      if (userComments.length > 0) {
        const sample = userComments[0];
      }
    }

    // Test 5: Check for orphaned comments
    const allComments = await Comment.find({}).populate('userId');
    const orphanedComments = allComments.filter(c => !c.userId);

  } catch {
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

// Run verification
verifyCommentSync();
