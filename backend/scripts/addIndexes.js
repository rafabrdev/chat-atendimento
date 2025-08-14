require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');

// Models
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const File = require('../models/File');
const Agent = require('../models/Agent');

async function addIndexes() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-atendimento', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('Connected to MongoDB');
    console.log('Adding performance indexes...');

    // User indexes
    await User.collection.createIndex({ email: 1 }, { unique: true });
    await User.collection.createIndex({ role: 1 });
    await User.collection.createIndex({ createdAt: -1 });
    console.log('✓ User indexes added');

    // Conversation indexes
    await Conversation.collection.createIndex({ status: 1, createdAt: -1 });
    await Conversation.collection.createIndex({ client: 1, createdAt: -1 });
    await Conversation.collection.createIndex({ assignedAgent: 1, status: 1 });
    await Conversation.collection.createIndex({ lastMessageAt: -1 });
    await Conversation.collection.createIndex({ rating: 1 });
    await Conversation.collection.createIndex({ priority: 1, createdAt: -1 });
    await Conversation.collection.createIndex({ tags: 1 });
    console.log('✓ Conversation indexes added');

    // Message indexes
    await Message.collection.createIndex({ conversationId: 1, createdAt: -1 });
    await Message.collection.createIndex({ sender: 1, createdAt: -1 });
    await Message.collection.createIndex({ senderType: 1 });
    await Message.collection.createIndex({ isRead: 1 });
    await Message.collection.createIndex({ content: 'text' }); // Text index for search
    console.log('✓ Message indexes added');

    // File indexes
    await File.collection.createIndex({ conversation: 1, createdAt: -1 });
    await File.collection.createIndex({ uploadedBy: 1, createdAt: -1 });
    await File.collection.createIndex({ fileType: 1 });
    await File.collection.createIndex({ mimetype: 1 });
    console.log('✓ File indexes added');

    // Agent indexes
    await Agent.collection.createIndex({ user: 1 }, { unique: true });
    await Agent.collection.createIndex({ status: 1, 'availability.isAvailable': 1 });
    await Agent.collection.createIndex({ 'performance.averageRating': -1 });
    await Agent.collection.createIndex({ 'availability.currentActiveChats': 1 });
    await Agent.collection.createIndex({ skills: 1 });
    await Agent.collection.createIndex({ departments: 1 });
    console.log('✓ Agent indexes added');

    // Compound indexes for common queries
    await Conversation.collection.createIndex({ 
      status: 1, 
      assignedAgent: 1, 
      createdAt: -1 
    });
    
    await Message.collection.createIndex({ 
      conversationId: 1, 
      senderType: 1, 
      createdAt: -1 
    });

    console.log('✓ Compound indexes added');

    console.log('\n✅ All indexes created successfully!');

    // List all indexes
    console.log('\n📊 Current indexes:');
    const collections = ['users', 'conversations', 'messages', 'files', 'agents'];
    
    for (const collection of collections) {
      const indexes = await mongoose.connection.collection(collection).indexes();
      console.log(`\n${collection}:`);
      indexes.forEach(index => {
        console.log(`  - ${JSON.stringify(index.key)}`);
      });
    }

  } catch (error) {
    console.error('Error adding indexes:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

// Run the script
addIndexes();
