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
    console.log('🔄 Starting comment migration...');
    console.log('📊 Connecting to database...');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');

    // Count total comments
    const totalComments = await Comment.countDocuments({});
    console.log(`📝 Found ${totalComments} comments to migrate`);

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

    console.log(`✅ Migration completed!`);
    console.log(`   - Modified: ${result.modifiedCount} comments`);
    console.log(`   - Matched: ${result.matchedCount} comments`);
    
    // Verify migration
    const sampleComment = await Comment.findOne({}).populate('userId', 'name email avatar');
    if (sampleComment) {
      console.log('\n📋 Sample comment after migration:');
      console.log(`   - Comment ID: ${sampleComment._id}`);
      console.log(`   - User: ${sampleComment.userId?.name || 'N/A'}`);
      console.log(`   - Avatar: ${sampleComment.userId?.avatar ? '✓ (from User)' : '✗'}`);
      console.log(`   - Has username field: ${sampleComment.username !== undefined ? '✗ (should be removed)' : '✓'}`);
      console.log(`   - Has avatar field: ${sampleComment.avatar !== undefined ? '✗ (should be removed)' : '✓'}`);
    }

    console.log('\n🎉 Migration successful! Comments will now always show latest user avatar.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('👋 Database connection closed');
    process.exit(0);
  }
}

// Run migration
migrateComments();
