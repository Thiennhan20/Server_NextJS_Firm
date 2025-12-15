/**
 * Migration Script: Remove username and avatar fields from Comment documents
 * 
 * This script removes the deprecated username and avatar fields from all Comment documents.
 * After this migration, comments will only use userId reference to get user data dynamically.
 * 
 * Benefits:
 * - Avatar changes automatically sync across all comments
 * - No need to update old comments when user changes avatar
 * - Cleaner data model with single source of truth
 * 
 * Usage:
 * node scripts/migrateComments.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Comment = require('../models/Comment');

async function migrateComments() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    // Count total comments
    const totalComments = await Comment.countDocuments({});

    // Remove username and avatar fields from all comments
    const result = await Comment.updateMany(
      {},
      { 
        $unset: { 
          username: "",
          avatar: "" 
        } 
      }
    );
    
    // Verify migration
    const sampleComment = await Comment.findOne({}).populate('userId', 'name email avatar');
    
  } catch (error) {
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

// Run migration
migrateComments();
