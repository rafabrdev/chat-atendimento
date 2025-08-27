/**
 * Script to seed test user in database
 * 
 * Usage: node scripts/seedTestUser.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Tenant = require('../models/Tenant');

async function seedTestUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB Connected');

    // Find default tenant
    let tenant = await Tenant.findOne({ key: 'default' });
    
    if (!tenant) {
      console.log('Default tenant not found, creating...');
      tenant = await Tenant.create({
        key: 'default',
        name: 'Default Organization',
        companyName: 'Default Organization',
        slug: 'default',
        isActive: true,
        status: 'active',
        plan: {
          name: 'trial',
          level: 1,
          features: ['chat', 'dashboard', 'analytics']
        },
        allowedModules: ['chat', 'dashboard', 'analytics'],
        limits: {
          maxUsers: 10,
          maxAgents: 5,
          maxConversations: 100
        },
        settings: {
          branding: {
            colors: {
              primary: '#007bff',
              secondary: '#6c757d'
            }
          }
        }
      });
      console.log('✅ Default tenant created');
    }

    // Check if test user already exists
    const existingUser = await User.findOne({ email: 'admin@test.com' });
    
    if (existingUser) {
      console.log('Test user already exists, updating password...');
      
      // Update password
      const hashedPassword = await bcrypt.hash('Test@123', 10);
      existingUser.password = hashedPassword;
      existingUser.name = existingUser.name || 'Admin Test';
      existingUser.company = existingUser.company || 'Test Company';
      existingUser.isActive = true;
      existingUser.emailVerified = true;
      await existingUser.save();
      
      console.log('✅ Test user password updated');
    } else {
      // Create test user
      const hashedPassword = await bcrypt.hash('Test@123', 10);
      
      const testUser = await User.create({
        email: 'admin@test.com',
        password: hashedPassword,
        name: 'Admin Test',
        company: 'Test Company',
        firstName: 'Admin',
        lastName: 'Test',
        displayName: 'Admin Test',
        role: 'admin',
        tenantId: tenant._id,
        isActive: true,
        emailVerified: true,
        profile: {
          bio: 'Test admin user',
          avatar: null
        },
        preferences: {
          language: 'pt-BR',
          timezone: 'America/Sao_Paulo',
          notifications: {
            email: true,
            push: true,
            sms: false
          }
        }
      });
      
      console.log('✅ Test user created');
    }

    console.log('\n📧 Test User Credentials:');
    console.log('Email: admin@test.com');
    console.log('Password: Test@123');
    console.log('Role: admin');
    console.log('Tenant: default\n');

    // Close connection
    await mongoose.connection.close();
    console.log('✅ Done!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the script
seedTestUser();
