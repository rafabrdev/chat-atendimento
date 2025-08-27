/**
 * Seed para criar o tenant "default" inicial
 * Este tenant será usado para migrar todos os dados existentes
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Importar o modelo Tenant
const Tenant = require('../models/Tenant');

async function seedDefaultTenant() {
  try {
    // Conectar ao banco de dados
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-atendimento', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('✅ Conectado ao MongoDB');
    
    // Verificar se o tenant default já existe
    const existingTenant = await Tenant.findOne({ slug: 'default' });
    
    if (existingTenant) {
      console.log('⚠️  Tenant "default" já existe. Atualizando configurações...');
      
      // Atualizar configurações se necessário
      existingTenant.allowedOrigins = existingTenant.allowedOrigins || [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:5173',
        'http://localhost:5174',
        '*' // Permitir todas as origens durante a migração
      ];
      
      // Garantir que o tenant está ativo
      existingTenant.isActive = true;
      existingTenant.subscription.status = 'active';
      
      // Atualizar módulos habilitados
      existingTenant.modules.chat.enabled = true;
      existingTenant.modules.chat.maxAgents = 100; // Limite generoso para o default
      existingTenant.modules.chat.maxConcurrentChats = 1000;
      
      // Atualizar limites para valores generosos
      existingTenant.limits = {
        users: 1000,
        storage: 100, // 100GB
        monthlyMessages: 1000000,
        monthlyMinutes: 100000,
        apiCalls: 10000000
      };
      
      await existingTenant.save();
      console.log('✅ Tenant "default" atualizado com sucesso!');
      
    } else {
      // Criar novo tenant default
      const defaultTenant = new Tenant({
        companyName: 'Default Organization',
        slug: 'default',
        domain: null, // Sem domínio específico para o default
        contactEmail: process.env.ADMIN_EMAIL || 'admin@example.com',
        
        // Origens permitidas - incluir todas as URLs de desenvolvimento
        allowedOrigins: [
          'http://localhost:3000',
          'http://localhost:3001', 
          'http://localhost:5173',
          'http://localhost:5174',
          '*' // Permitir todas as origens durante a migração
        ],
        
        // Webhooks vazios por padrão
        webhooks: [],
        
        // Módulos habilitados
        modules: {
          chat: {
            enabled: true,
            maxAgents: 100,
            maxConcurrentChats: 1000,
            features: {
              fileUpload: true,
              videoCall: true,
              voiceCall: true,
              chatbot: true,
              analytics: true
            }
          },
          crm: {
            enabled: true,
            maxContacts: 10000,
            features: {
              pipeline: true,
              automation: true,
              emailMarketing: true
            }
          },
          hrm: {
            enabled: false,
            maxEmployees: 50,
            features: {
              payroll: false,
              timeTracking: true,
              recruitment: false
            }
          }
        },
        
        // Subscription
        subscription: {
          plan: 'enterprise', // Plano máximo para o tenant default
          status: 'active',
          billingCycle: 'yearly',
          monthlyPrice: 0 // Gratuito para o tenant default
        },
        
        // Limites generosos para o tenant default
        limits: {
          users: 1000,
          storage: 100, // 100GB
          monthlyMessages: 1000000,
          monthlyMinutes: 100000,
          apiCalls: 10000000
        },
        
        // Configurações padrão
        settings: {
          timezone: 'America/Sao_Paulo',
          language: 'pt-BR',
          currency: 'BRL',
          dateFormat: 'DD/MM/YYYY',
          branding: {
            primaryColor: '#007bff',
            logo: null,
            favicon: null,
            emailTemplate: null
          },
          security: {
            requireMFA: false,
            passwordPolicy: {
              minLength: 8,
              requireUppercase: true,
              requireNumbers: true,
              requireSpecialChars: false
            },
            ipWhitelist: [],
            sessionTimeout: 30
          }
        },
        
        // Metadados
        metadata: {
          industry: 'Technology',
          size: 'enterprise',
          source: 'Migration',
          notes: 'Tenant criado automaticamente para migração de dados existentes'
        },
        
        // Status
        isActive: true,
        isSuspended: false
      });
      
      await defaultTenant.save();
      console.log('✅ Tenant "default" criado com sucesso!');
      console.log(`   ID: ${defaultTenant._id}`);
      console.log(`   Slug: ${defaultTenant.slug}`);
      console.log(`   Nome: ${defaultTenant.companyName}`);
    }
    
    // Exibir estatísticas
    const tenant = await Tenant.findOne({ slug: 'default' });
    console.log('\n📊 Configurações do Tenant Default:');
    console.log(`   - Módulos habilitados: ${Object.keys(tenant.modules).filter(m => tenant.modules[m].enabled).join(', ')}`);
    console.log(`   - Plano: ${tenant.subscription.plan}`);
    console.log(`   - Status: ${tenant.subscription.status}`);
    console.log(`   - Origens permitidas: ${tenant.allowedOrigins.length}`);
    console.log(`   - Limites de usuários: ${tenant.limits.users}`);
    console.log(`   - Limites de mensagens mensais: ${tenant.limits.monthlyMessages}`);
    
  } catch (error) {
    console.error('❌ Erro ao criar/atualizar tenant default:', error);
    process.exit(1);
  } finally {
    // Desconectar do banco
    await mongoose.disconnect();
    console.log('\n✅ Seed concluído e conexão fechada');
  }
}

// Executar seed se for chamado diretamente
if (require.main === module) {
  seedDefaultTenant();
}

module.exports = seedDefaultTenant;
