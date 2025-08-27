const express = require('express');
const router = express.Router();
const stripeService = require('../services/stripeService');
const { auth } = require('../middleware/auth');
const { requireTenant, requireRole } = require('../middleware/roleAuth');

/**
 * @swagger
 * tags:
 *   name: Stripe
 *   description: Integração com Stripe para pagamentos
 */

/**
 * @swagger
 * /api/stripe/webhook:
 *   post:
 *     tags: [Stripe]
 *     summary: Webhook do Stripe
 *     description: Processa eventos do Stripe (checkout, pagamentos, etc)
 */
router.post('/webhook', 
  express.raw({ type: 'application/json' }), // Importante: raw body para verificar assinatura
  async (req, res) => {
    try {
      const signature = req.headers['stripe-signature'];
      
      if (!signature) {
        return res.status(400).json({
          success: false,
          message: 'Missing stripe signature'
        });
      }

      const result = await stripeService.handleWebhook(req.body, signature);
      
      res.json(result);
    } catch (error) {
      console.error('Webhook error:', error);
      
      if (error.message === 'Invalid signature') {
        return res.status(400).json({
          success: false,
          message: 'Invalid webhook signature'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Webhook processing failed',
        error: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/stripe/create-checkout:
 *   post:
 *     tags: [Stripe]
 *     summary: Criar sessão de checkout
 *     description: Cria uma nova sessão de checkout do Stripe
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               plan:
 *                 type: string
 *                 enum: [starter, professional, enterprise]
 *               billingCycle:
 *                 type: string
 *                 enum: [monthly, yearly]
 *               email:
 *                 type: string
 */
router.post('/create-checkout', async (req, res) => {
  try {
    const { plan, billingCycle, email } = req.body;

    if (!plan || !billingCycle) {
      return res.status(400).json({
        success: false,
        message: 'Plano e ciclo de cobrança são obrigatórios'
      });
    }

    const session = await stripeService.createCheckoutSession(
      plan,
      billingCycle,
      email
    );

    res.json({
      success: true,
      data: {
        sessionId: session.id,
        url: session.url
      }
    });
  } catch (error) {
    console.error('Erro ao criar checkout:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar sessão de checkout',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/stripe/customer-portal:
 *   post:
 *     tags: [Stripe]
 *     summary: Criar portal do cliente
 *     description: Cria uma sessão do portal de billing do Stripe
 *     security:
 *       - bearerAuth: []
 */
router.post('/customer-portal', 
  auth,
  requireTenant(),
  requireRole('admin'),
  async (req, res) => {
    try {
      const session = await stripeService.createCustomerPortal(req.tenant._id);

      res.json({
        success: true,
        data: {
          url: session.url
        }
      });
    } catch (error) {
      console.error('Erro ao criar portal:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao criar portal do cliente',
        error: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/stripe/plans:
 *   get:
 *     tags: [Stripe]
 *     summary: Listar planos disponíveis
 *     description: Retorna todos os planos disponíveis com preços e features
 */
router.get('/plans', (req, res) => {
  const plans = stripeService.plans;
  
  // Formatar para exibição
  const formattedPlans = Object.entries(plans).map(([key, plan]) => ({
    id: key,
    name: plan.name,
    prices: {
      monthly: stripeService.getPlanPrice(key, 'monthly'),
      yearly: stripeService.getPlanPrice(key, 'yearly')
    },
    features: plan.features,
    recommended: key === 'professional' // Marcar plano recomendado
  }));

  res.json({
    success: true,
    data: formattedPlans
  });
});

/**
 * @swagger
 * /api/stripe/verify-session/{sessionId}:
 *   get:
 *     tags: [Stripe]
 *     summary: Verificar sessão de checkout
 *     description: Verifica se uma sessão de checkout é válida
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 */
router.get('/verify-session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const sessionData = await stripeService.verifyCheckoutSession(sessionId);
    
    res.json({
      success: true,
      data: sessionData
    });
  } catch (error) {
    console.error('Erro ao verificar sessão:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/stripe/complete-setup:
 *   post:
 *     tags: [Stripe]
 *     summary: Completar setup da empresa após pagamento
 *     description: Cria o tenant e usuário admin após confirmação do pagamento
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sessionId:
 *                 type: string
 *               companyName:
 *                 type: string
 *               adminName:
 *                 type: string
 *               adminEmail:
 *                 type: string
 *               adminPassword:
 *                 type: string
 *               phone:
 *                 type: string
 *               website:
 *                 type: string
 *               industry:
 *                 type: string
 *               companySize:
 *                 type: string
 */
router.post('/complete-setup', async (req, res) => {
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
    } = req.body;

    // Validar campos obrigatórios
    if (!sessionId || !companyName || !adminName || !adminEmail || !adminPassword || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Campos obrigatórios não preenchidos'
      });
    }

    // Completar setup
    const result = await stripeService.completeCompanySetup({
      sessionId,
      companyName,
      adminName,
      adminEmail,
      adminPassword,
      phone,
      website,
      industry,
      companySize
    });

    res.json({
      success: true,
      message: 'Empresa criada com sucesso',
      data: result
    });
  } catch (error) {
    console.error('Erro ao completar setup:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erro ao criar empresa'
    });
  }
});

/**
 * @swagger
 * /api/stripe/setup-products:
 *   post:
 *     tags: [Stripe]
 *     summary: Configurar produtos no Stripe (Master only)
 *     description: Cria produtos e preços no Stripe Dashboard
 *     security:
 *       - bearerAuth: []
 */
router.post('/setup-products',
  auth,
  requireRole('master'),
  async (req, res) => {
    try {
      const products = await stripeService.setupStripeProducts();
      
      res.json({
        success: true,
        message: 'Produtos criados com sucesso no Stripe',
        data: products
      });
    } catch (error) {
      console.error('Erro ao criar produtos:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao criar produtos no Stripe',
        error: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/stripe/subscription-status:
 *   get:
 *     tags: [Stripe]
 *     summary: Status da assinatura
 *     description: Retorna o status da assinatura do tenant atual
 *     security:
 *       - bearerAuth: []
 */
router.get('/subscription-status',
  auth,
  requireTenant(),
  async (req, res) => {
    try {
      const tenant = req.tenant;
      
      const subscriptionData = {
        plan: tenant.subscription.plan,
        status: tenant.subscription.status,
        billingCycle: tenant.subscription.billingCycle,
        currentPeriodEnd: tenant.subscription.currentPeriodEnd,
        trialEndsAt: tenant.subscription.trialEndsAt,
        isActive: tenant.isActive,
        isSuspended: tenant.isSuspended,
        limits: tenant.limits,
        usage: tenant.usage
      };

      // Se tem trial ativo
      if (tenant.subscription.trialEndsAt && new Date() < tenant.subscription.trialEndsAt) {
        const daysRemaining = Math.ceil(
          (tenant.subscription.trialEndsAt - new Date()) / (1000 * 60 * 60 * 24)
        );
        subscriptionData.trialDaysRemaining = daysRemaining;
      }

      res.json({
        success: true,
        data: subscriptionData
      });
    } catch (error) {
      console.error('Erro ao buscar status:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao buscar status da assinatura',
        error: error.message
      });
    }
  }
);

module.exports = router;
