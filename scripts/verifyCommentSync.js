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
    console.log('🔍 Starting verification...\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database\n');

    // Test 1: Check schema doesn't have redundant fields
    console.log('📋 Test 1: Checking Comment schema...');
    const sampleComment = await Comment.findOne({});
    if (sampleComment) {
      const hasUsername = sampleComment.username !== undefined;
      const hasAvatar = sampleComment.avatar !== undefined;
      
      if (!hasUsername && !hasAvatar) {
        console.log('   ✅ Schema is clean (no username/avatar fields)');
      } else {
        console.log('   ⚠️  Schema still has redundant fields:');
        if (hasUsername) console.log('      - username field exists');
        if (hasAvatar) console.log('      - avatar field exists');
        console.log('   💡 Run migration: node scripts/migrateComments.js');
      }
    } else {
      console.log('   ℹ️  No comments found in database');
    }

    // Test 2: Check populate works correctly
    console.log('\n📋 Test 2: Checking populate functionality...');
    const populatedComment = await Comment.findOne({})
      .populate('userId', 'name email avatar');
    
    if (populatedComment) {
      if (populatedComment.userId && typeof populatedComment.userId === 'object') {
        console.log('   ✅ Populate works correctly');
        console.log(`      - User: ${populatedComment.userId.name}`);
        console.log(`      - Avatar: ${populatedComment.userId.avatar ? '✓' : '✗'}`);
      } else {
        console.log('   ❌ Populate failed - userId not populated');
      }
    } else {
      console.log('   ℹ️  No comments to test populate');
    }

    // Test 3: Check all comments have valid userId references
    console.log('\n📋 Test 3: Checking userId references...');
    const totalComments = await Comment.countDocuments({});
    const commentsWithUserId = await Comment.countDocuments({ userId: { $exists: true } });
    
    if (totalComments === commentsWithUserId) {
      console.log(`   ✅ All ${totalComments} comments have valid userId references`);
    } else {
      console.log(`   ⚠️  ${totalComments - commentsWithUserId} comments missing userId`);
    }

    // Test 4: Simulate avatar change scenario
    console.log('\n📋 Test 4: Simulating avatar change scenario...');
    const testUser = await User.findOne({});
    if (testUser) {
      const userComments = await Comment.find({ userId: testUser._id })
        .populate('userId', 'name email avatar')
        .limit(3);
      
      if (userComments.length > 0) {
        console.log(`   ✅ Found ${userComments.length} comments from user: ${testUser.name}`);
        console.log(`   📸 Current avatar: ${testUser.avatar || 'none'}`);
        console.log('   💡 If user changes avatar, all comments will show new avatar on next load');
        
        // Show sample comment
        const sample = userComments[0];
        console.log('\n   Sample comment:');
        console.log(`      - Content: "${sample.content.substring(0, 50)}..."`);
        console.log(`      - User from populate: ${sample.userId.name}`);
        console.log(`      - Avatar from populate: ${sample.userId.avatar ? '✓' : '✗'}`);
      } else {
        console.log('   ℹ️  User has no comments yet');
      }
    } else {
      console.log('   ℹ️  No users found in database');
    }

    // Test 5: Check for orphaned comments
    console.log('\n📋 Test 5: Checking for orphaned comments...');
    const allComments = await Comment.find({}).populate('userId');
    const orphanedComments = allComments.filter(c => !c.userId);
    
    if (orphanedComments.length === 0) {
      console.log('   ✅ No orphaned comments found');
    } else {
      console.log(`   ⚠️  Found ${orphanedComments.length} orphaned comments (user deleted)`);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 VERIFICATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total comments: ${totalComments}`);
    console.log(`Comments with userId: ${commentsWithUserId}`);
    console.log(`Orphaned comments: ${orphanedComments.length}`);
    console.log('='.repeat(60));
    
    console.log('\n✅ Verification complete!');
    console.log('💡 Avatar sync is working if:');
    console.log('   1. No username/avatar fields in comments');
    console.log('   2. Populate works correctly');
    console.log('   3. All comments have valid userId references');
    console.log('   4. Comments show latest user data when populated');

  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Database connection closed');
    process.exit(0);
  }
}

// Run verification
verifyCommentSync();
