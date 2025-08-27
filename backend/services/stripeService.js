const Stripe = require('stripe');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const emailService = require('./emailService');
const crypto = require('crypto');

// Inicializar Stripe com a chave secreta
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_xxxxx', {
  apiVersion: '2023-10-16'
});

class StripeService {
  constructor() {
    this.stripe = stripe;
    
    // Planos disponíveis (IDs do Stripe)
    this.plans = {
      starter: {
        name: 'Starter',
        priceMonthly: 'price_1S065PPw0PDAKBHmjmyVbXOe',
        priceYearly: 'price_1S065QPw0PDAKBHm5MQb1dUl',
        features: {
          users: 10,
          agents: 3,
          storage: 5, // GB
          monthlyMessages: 10000,
          modules: {
            chat: true,
            crm: false,
            hrm: false
          }
        }
      },
      professional: {
        name: 'Professional',
        priceMonthly: 'price_1S065QPw0PDAKBHmiMS1is2R',
        priceYearly: 'price_1S065RPw0PDAKBHmGb83s4Vx',
        features: {
          users: 50,
          agents: 10,
          storage: 20,
          monthlyMessages: 50000,
          modules: {
            chat: true,
            crm: true,
            hrm: false
          }
        }
      },
      enterprise: {
        name: 'Enterprise',
        priceMonthly: 'price_1S065SPw0PDAKBHmo6QjopQU',
        priceYearly: 'price_1S065SPw0PDAKBHmAdaqU5rl',
        features: {
          users: -1, // Ilimitado
          agents: -1,
          storage: 100,
          monthlyMessages: -1,
          modules: {
            chat: true,
            crm: true,
            hrm: true
          }
        }
      }
    };
  }

  /**
   * Criar sessão de checkout
   */
  async createCheckoutSession(planType, billingCycle, customerEmail = null) {
    try {
      const plan = this.plans[planType];
      if (!plan) {
        throw new Error('Plano inválido');
      }

      const priceId = billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
      
      // URLs de redirecionamento baseadas no ambiente
      const protocol = process.env.APP_PROTOCOL || 'http';
      const domain = process.env.APP_DOMAIN || 'localhost:5173';
      const successUrl = `${protocol}://${domain}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${protocol}://${domain}/pricing`;

      // Criar sessão de checkout
      const sessionConfig = {
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1
          }
        ],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        subscription_data: {
          metadata: {
            plan: planType
          }
        },
        metadata: {
          plan: planType,
          billingCycle
        },
        // Coletar informações adicionais
        billing_address_collection: 'auto',
        // Permitir códigos promocionais
        allow_promotion_codes: true
      };
      
      // Adicionar email somente se fornecido
      if (customerEmail && customerEmail.trim() !== '') {
        sessionConfig.customer_email = customerEmail;
      }
      
      const session = await this.stripe.checkout.sessions.create(sessionConfig);

      return session;
    } catch (error) {
      console.error('Erro ao criar sessão de checkout:', error);
      throw error;
    }
  }

  /**
   * Processar webhook do Stripe
   */
  async handleWebhook(rawBody, signature) {
    try {
      // Verificar assinatura do webhook
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      let event;

      try {
        event = this.stripe.webhooks.constructEvent(
          rawBody,
          signature,
          webhookSecret
        );
      } catch (err) {
        console.error('Webhook signature verification failed:', err);
        throw new Error('Invalid signature');
      }

      // Processar diferentes tipos de eventos
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(event.data.object);
          break;

        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event.data.object);
          break;

        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionCancelled(event.data.object);
          break;

        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(event.data.object);
          break;

        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object);
          break;

        case 'customer.subscription.trial_will_end':
          await this.handleTrialEnding(event.data.object);
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      return { received: true };
    } catch (error) {
      console.error('Erro ao processar webhook:', error);
      throw error;
    }
  }

  /**
   * Processar checkout completado
   */
  async handleCheckoutCompleted(session) {
    try {
      console.log('Processando checkout completado:', session.id);

      // Recuperar detalhes completos da sessão
      const fullSession = await this.stripe.checkout.sessions.retrieve(
        session.id,
        {
          expand: ['customer', 'subscription', 'line_items']
        }
      );

      const customerEmail = fullSession.customer_details.email;
      const customerName = fullSession.customer_details.name;
      const customerPhone = fullSession.customer_details.phone;
      const companyName = fullSession.custom_fields.find(f => f.key === 'company_name')?.text?.value || customerName;
      const plan = fullSession.metadata.plan;
      const billingCycle = fullSession.metadata.billingCycle || 'monthly';

      // Verificar se já existe um tenant para este customer
      let tenant = await Tenant.findOne({
        'subscription.stripeCustomerId': fullSession.customer
      });

      if (tenant) {
        console.log('Tenant já existe para este customer');
        return;
      }

      // Gerar slug único para a empresa
      const slug = await Tenant.generateSlug(companyName);

      // Gerar senha temporária para o admin
      const temporaryPassword = crypto.randomBytes(8).toString('hex');

      // Criar admin da empresa
      // Para compras via Stripe, usar um ID especial do sistema como createdBy
      // ou buscar o usuário master
      const masterUser = await User.findOne({ role: 'master' }).select('_id');
      
      const admin = new User({
        name: customerName,
        email: customerEmail,
        password: temporaryPassword,
        role: 'admin',
        company: companyName,
        createdBy: masterUser ? masterUser._id : null, // Se houver master, usar seu ID
        profile: {
          phone: customerPhone
        },
        invitationToken: crypto.randomBytes(32).toString('hex'),
        invitationExpires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 dias
      });

      await admin.save();

      // Criar tenant
      tenant = new Tenant({
        companyName,
        slug,
        contactEmail: customerEmail,
        contactPhone: customerPhone,
        owner: admin._id,
        
        // Configurar módulos baseado no plano
        modules: {
          chat: {
            enabled: this.plans[plan].features.modules.chat,
            maxAgents: this.plans[plan].features.agents,
            maxConcurrentChats: this.plans[plan].features.agents * 5
          },
          crm: {
            enabled: this.plans[plan].features.modules.crm,
            maxContacts: this.plans[plan].features.users * 100
          },
          hrm: {
            enabled: this.plans[plan].features.modules.hrm,
            maxEmployees: this.plans[plan].features.users
          }
        },
        
        // Configurar assinatura
        subscription: {
          plan,
          status: 'active',
          billingCycle,
          stripeCustomerId: fullSession.customer,
          stripeSubscriptionId: fullSession.subscription,
          trialEndsAt: fullSession.subscription_data?.trial_end 
            ? new Date(fullSession.subscription_data.trial_end * 1000)
            : null,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          monthlyPrice: this.getPlanPrice(plan, billingCycle)
        },
        
        // Configurar limites baseado no plano
        limits: {
          users: this.plans[plan].features.users,
          storage: this.plans[plan].features.storage,
          monthlyMessages: this.plans[plan].features.monthlyMessages,
          monthlyMinutes: 1000,
          apiCalls: 100000
        },
        
        // Metadados
        metadata: {
          source: 'stripe_checkout',
          industry: fullSession.customer_details.address?.country
        }
      });

      await tenant.save();

      // Atualizar admin com tenantId
      admin.tenantId = tenant._id;
      await admin.save();

      // Enviar email de boas-vindas
      try {
        await emailService.sendAdminWelcome(admin, tenant, temporaryPassword);
      } catch (emailError) {
        console.error('Erro ao enviar email de boas-vindas:', emailError);
      }

      // Notificar master sobre nova compra
      try {
        await emailService.sendMasterNotification('new-purchase', {
          companyName,
          adminName: customerName,
          adminEmail: customerEmail,
          plan,
          billingCycle,
          amount: fullSession.amount_total / 100
        });
      } catch (notifyError) {
        console.error('Erro ao notificar master:', notifyError);
      }

      console.log(`Tenant criado com sucesso: ${tenant.slug}`);
    } catch (error) {
      console.error('Erro ao processar checkout:', error);
      throw error;
    }
  }

  /**
   * Processar atualização de assinatura
   */
  async handleSubscriptionUpdated(subscription) {
    try {
      const tenant = await Tenant.findOne({
        'subscription.stripeSubscriptionId': subscription.id
      });

      if (!tenant) {
        console.log('Tenant não encontrado para subscription:', subscription.id);
        return;
      }

      // Atualizar status da assinatura
      tenant.subscription.status = subscription.status;
      
      if (subscription.current_period_end) {
        tenant.subscription.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
      }

      if (subscription.cancel_at_period_end) {
        tenant.subscription.cancelledAt = new Date();
      }

      // Atualizar plano se mudou
      const newPlan = subscription.metadata?.plan;
      if (newPlan && newPlan !== tenant.subscription.plan) {
        tenant.subscription.plan = newPlan;
        
        // Atualizar limites e módulos
        await this.updateTenantFeatures(tenant, newPlan);
      }

      await tenant.save();
      console.log(`Assinatura atualizada para tenant: ${tenant.slug}`);
    } catch (error) {
      console.error('Erro ao atualizar assinatura:', error);
      throw error;
    }
  }

  /**
   * Processar cancelamento de assinatura
   */
  async handleSubscriptionCancelled(subscription) {
    try {
      const tenant = await Tenant.findOne({
        'subscription.stripeSubscriptionId': subscription.id
      });

      if (!tenant) {
        return;
      }

      tenant.subscription.status = 'cancelled';
      tenant.subscription.cancelledAt = new Date();
      tenant.isActive = false;
      
      await tenant.save();

      // Notificar admin
      const admin = await User.findById(tenant.owner);
      if (admin) {
        // TODO: Enviar email de cancelamento
      }

      // Notificar master
      await emailService.sendMasterNotification('subscription-cancelled', {
        companyName: tenant.companyName,
        plan: tenant.subscription.plan
      });

      console.log(`Assinatura cancelada para tenant: ${tenant.slug}`);
    } catch (error) {
      console.error('Erro ao processar cancelamento:', error);
      throw error;
    }
  }

  /**
   * Processar pagamento bem-sucedido
   */
  async handlePaymentSucceeded(invoice) {
    try {
      const tenant = await Tenant.findOne({
        'subscription.stripeCustomerId': invoice.customer
      });

      if (!tenant) {
        return;
      }

      // Registrar pagamento
      if (!tenant.subscription.payments) {
        tenant.subscription.payments = [];
      }

      tenant.subscription.payments.push({
        invoiceId: invoice.id,
        amount: invoice.amount_paid / 100,
        currency: invoice.currency,
        paidAt: new Date(invoice.status_transitions.paid_at * 1000),
        invoiceUrl: invoice.hosted_invoice_url
      });

      // Limitar histórico de pagamentos
      if (tenant.subscription.payments.length > 100) {
        tenant.subscription.payments = tenant.subscription.payments.slice(-100);
      }

      await tenant.save();
      console.log(`Pagamento registrado para tenant: ${tenant.slug}`);
    } catch (error) {
      console.error('Erro ao processar pagamento:', error);
      throw error;
    }
  }

  /**
   * Processar falha de pagamento
   */
  async handlePaymentFailed(invoice) {
    try {
      const tenant = await Tenant.findOne({
        'subscription.stripeCustomerId': invoice.customer
      });

      if (!tenant) {
        return;
      }

      // Suspender após 3 tentativas falhas
      const attempts = invoice.attempt_count || 1;
      if (attempts >= 3) {
        tenant.isSuspended = true;
        tenant.suspendedReason = 'Falha no pagamento';
        tenant.subscription.status = 'suspended';
      }

      await tenant.save();

      // Notificar admin
      const admin = await User.findById(tenant.owner);
      if (admin) {
        // TODO: Enviar email de falha de pagamento
      }

      // Notificar master
      await emailService.sendMasterNotification('payment-failed', {
        companyName: tenant.companyName,
        attempts,
        amount: invoice.amount_due / 100
      });

      console.log(`Falha de pagamento para tenant: ${tenant.slug}`);
    } catch (error) {
      console.error('Erro ao processar falha de pagamento:', error);
      throw error;
    }
  }

  /**
   * Processar fim de trial próximo
   */
  async handleTrialEnding(subscription) {
    try {
      const tenant = await Tenant.findOne({
        'subscription.stripeSubscriptionId': subscription.id
      });

      if (!tenant) {
        return;
      }

      // Enviar email 3 dias antes do fim do trial
      const admin = await User.findById(tenant.owner);
      if (admin) {
        // TODO: Enviar email de trial expirando
      }

      console.log(`Trial expirando para tenant: ${tenant.slug}`);
    } catch (error) {
      console.error('Erro ao processar trial expirando:', error);
      throw error;
    }
  }

  /**
   * Criar portal do cliente
   */
  async createCustomerPortal(tenantId) {
    try {
      const tenant = await Tenant.findById(tenantId);
      if (!tenant || !tenant.subscription.stripeCustomerId) {
        throw new Error('Tenant não encontrado ou sem customer Stripe');
      }

      const returnUrl = `${process.env.APP_PROTOCOL}://${process.env.APP_DOMAIN}/empresa/${tenant.slug}/billing`;

      const session = await this.stripe.billingPortal.sessions.create({
        customer: tenant.subscription.stripeCustomerId,
        return_url: returnUrl
      });

      return session;
    } catch (error) {
      console.error('Erro ao criar portal do cliente:', error);
      throw error;
    }
  }

  /**
   * Atualizar features do tenant baseado no plano
   */
  async updateTenantFeatures(tenant, plan) {
    const planFeatures = this.plans[plan].features;

    tenant.limits = {
      users: planFeatures.users,
      storage: planFeatures.storage,
      monthlyMessages: planFeatures.monthlyMessages,
      monthlyMinutes: 1000,
      apiCalls: 100000
    };

    tenant.modules.chat.enabled = planFeatures.modules.chat;
    tenant.modules.crm.enabled = planFeatures.modules.crm;
    tenant.modules.hrm.enabled = planFeatures.modules.hrm;

    return tenant;
  }

  /**
   * Obter preço do plano
   */
  getPlanPrice(plan, billingCycle) {
    // Estes valores devem corresponder aos configurados no Stripe
    const prices = {
      starter: {
        monthly: 49,
        yearly: 490
      },
      professional: {
        monthly: 99,
        yearly: 990
      },
      enterprise: {
        monthly: 299,
        yearly: 2990
      }
    };

    return prices[plan]?.[billingCycle] || 0;
  }

  /**
   * Verificar sessão de checkout
   */
  async verifyCheckoutSession(sessionId) {
    try {
      const session = await this.stripe.checkout.sessions.retrieve(sessionId);
      
      if (!session) {
        throw new Error('Sessão não encontrada');
      }
      
      // Verificar se o pagamento foi concluído
      if (session.payment_status !== 'paid') {
        throw new Error('Pagamento não confirmado');
      }
      
      // Retornar dados relevantes
      return {
        sessionId: session.id,
        customerEmail: session.customer_details?.email,
        customerName: session.customer_details?.name,
        plan: session.metadata?.plan,
        billingCycle: session.metadata?.billingCycle,
        amountTotal: session.amount_total / 100,
        currency: session.currency,
        paymentStatus: session.payment_status,
        stripeCustomerId: session.customer
      };
    } catch (error) {
      console.error('Erro ao verificar sessão:', error);
      throw error;
    }
  }
  
  /**
   * Completar setup da empresa após pagamento
   */
  async completeCompanySetup(data) {
    try {
      const {
        sessionId,
        companyName,
        adminName,
        adminEmail,
        adminPassword,
        phone,
        website,
        industry,
        companySize
      } = data;
      
      // Verificar sessão novamente
      const session = await this.stripe.checkout.sessions.retrieve(sessionId);
      
      if (session.payment_status !== 'paid') {
        throw new Error('Pagamento não confirmado');
      }
      
      // Verificar se já existe um tenant para esta sessão
      const existingTenant = await Tenant.findOne({
        'subscription.checkoutSessionId': sessionId
      });
      
      if (existingTenant) {
        throw new Error('Empresa já cadastrada para esta sessão');
      }
      
      // Verificar se email já existe
      const existingUser = await User.findOne({ email: adminEmail });
      if (existingUser) {
        throw new Error('Email já cadastrado no sistema');
      }
      
      // Gerar slug único para a empresa
      const slug = await Tenant.generateSlug(companyName);
      
      // Primeiro criar o tenant para ter o tenantId
      const plan = session.metadata?.plan || 'starter';
      const billingCycle = session.metadata?.billingCycle || 'monthly';
      const planFeatures = this.plans[plan].features;
      
      // Criar tenant primeiro
      const tenant = new Tenant({
        companyName,
        slug,
        contactEmail: adminEmail,
        contactPhone: phone,
        website,
        owner: null, // Será atualizado após criar o admin
        
        // Configurar módulos baseado no plano
        modules: {
          chat: {
            enabled: planFeatures.modules.chat,
            maxAgents: planFeatures.agents,
            maxConcurrentChats: planFeatures.agents * 5
          },
          crm: {
            enabled: planFeatures.modules.crm,
            maxContacts: planFeatures.users * 100
          },
          hrm: {
            enabled: planFeatures.modules.hrm,
            maxEmployees: planFeatures.users
          }
        },
        
        // Configurar assinatura
        subscription: {
          plan,
          status: 'active',
          billingCycle,
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription,
          checkoutSessionId: sessionId,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + (billingCycle === 'monthly' ? 30 : 365) * 24 * 60 * 60 * 1000),
          monthlyPrice: this.getPlanPrice(plan, billingCycle)
        },
        
        // Configurar limites baseado no plano
        limits: {
          users: planFeatures.users,
          storage: planFeatures.storage,
          monthlyMessages: planFeatures.monthlyMessages,
          monthlyMinutes: 1000,
          apiCalls: 100000
        },
        
        // Metadados
        metadata: {
          source: 'stripe_checkout',
          industry,
          companySize
        },
        
        isActive: true,
        isSuspended: false
      });
      
      await tenant.save();
      
      // Agora criar o admin com o tenantId
      // Para o primeiro admin, vamos usar o próprio ID dele como createdBy (auto-criado)
      const adminData = {
        name: adminName,
        email: adminEmail,
        password: adminPassword,
        role: 'admin',
        company: companyName,
        tenantId: tenant._id,
        profile: {
          phone,
          position: 'Administrador'
        },
        isActive: true
      };
      
      // Criar o admin sem o createdBy primeiro
      const admin = new User(adminData);
      admin.createdBy = admin._id; // Auto-referência para o primeiro admin
      
      await admin.save();
      
      // Atualizar tenant com o owner
      tenant.owner = admin._id;
      await tenant.save();
      
      // Enviar email de boas-vindas
      try {
        await emailService.sendAdminWelcome(admin, tenant, adminPassword);
      } catch (emailError) {
        console.error('Erro ao enviar email de boas-vindas:', emailError);
      }
      
      // Notificar master sobre nova compra
      try {
        await emailService.sendMasterNotification('new-purchase', {
          companyName,
          adminName,
          adminEmail,
          plan,
          billingCycle,
          amount: session.amount_total / 100
        });
      } catch (notifyError) {
        console.error('Erro ao notificar master:', notifyError);
      }
      
      console.log(`Tenant criado com sucesso: ${tenant.slug}`);
      
      return {
        tenantId: tenant._id,
        tenantSlug: tenant.slug,
        adminId: admin._id,
        adminEmail: admin.email
      };
    } catch (error) {
      console.error('Erro ao completar setup:', error);
      throw error;
    }
  }

  /**
   * Criar produtos e preços no Stripe (executar uma vez)
   */
  async setupStripeProducts() {
    try {
      const products = [];

      for (const [key, plan] of Object.entries(this.plans)) {
        // Criar produto
        const product = await this.stripe.products.create({
          name: `Chat Support - ${plan.name}`,
          description: `Plano ${plan.name} do Chat Support Platform`,
          metadata: {
            plan: key
          }
        });

        // Criar preço mensal
        const monthlyPrice = await this.stripe.prices.create({
          product: product.id,
          unit_amount: this.getPlanPrice(key, 'monthly') * 100, // Em centavos
          currency: 'brl',
          recurring: {
            interval: 'month'
          },
          metadata: {
            plan: key,
            billingCycle: 'monthly'
          }
        });

        // Criar preço anual
        const yearlyPrice = await this.stripe.prices.create({
          product: product.id,
          unit_amount: this.getPlanPrice(key, 'yearly') * 100,
          currency: 'brl',
          recurring: {
            interval: 'year'
          },
          metadata: {
            plan: key,
            billingCycle: 'yearly'
          }
        });

        products.push({
          plan: key,
          productId: product.id,
          monthlyPriceId: monthlyPrice.id,
          yearlyPriceId: yearlyPrice.id
        });

        console.log(`Produto criado: ${plan.name}`);
      }

      return products;
    } catch (error) {
      console.error('Erro ao criar produtos no Stripe:', error);
      throw error;
    }
  }
}

// Exportar instância única
module.exports = new StripeService();
