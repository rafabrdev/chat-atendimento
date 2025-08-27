const AWS = require('aws-sdk');
const path = require('path');
const fs = require('fs').promises;
const handlebars = require('handlebars');

// Configurar AWS SES
const ses = new AWS.SES({
  apiVersion: '2010-12-01',
  region: process.env.AWS_SES_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

class EmailService {
  constructor() {
    this.fromEmail = process.env.AWS_SES_FROM_EMAIL || 'noreply@example.com';
    this.fromName = process.env.AWS_SES_FROM_NAME || 'Chat Support';
    this.templatesPath = path.join(__dirname, '..', 'templates', 'emails');
    this.compiledTemplates = {};
  }

  /**
   * Compilar template Handlebars
   */
  async compileTemplate(templateName) {
    if (this.compiledTemplates[templateName]) {
      return this.compiledTemplates[templateName];
    }

    try {
      const templatePath = path.join(this.templatesPath, `${templateName}.hbs`);
      const templateContent = await fs.readFile(templatePath, 'utf-8');
      const compiled = handlebars.compile(templateContent);
      this.compiledTemplates[templateName] = compiled;
      return compiled;
    } catch (error) {
      console.error(`Erro ao compilar template ${templateName}:`, error);
      throw error;
    }
  }

  /**
   * Gerar URLs baseadas no tenant
   */
  generateTenantUrls(tenant) {
    const protocol = process.env.APP_PROTOCOL || 'http';
    const domain = process.env.APP_DOMAIN || 'localhost:5173';
    const useSubdomain = process.env.USE_SUBDOMAIN === 'true';

    let baseUrl;
    if (useSubdomain) {
      // Subdomínio: empresa.app.com
      baseUrl = `${protocol}://${tenant.slug}.${domain}`;
    } else {
      // Path: app.com/empresa/slug
      baseUrl = `${protocol}://${domain}/empresa/${tenant.slug}`;
    }

    return {
      baseUrl,
      loginUrl: `${baseUrl}/login`,
      dashboardUrl: `${baseUrl}/dashboard`,
      supportUrl: `${baseUrl}/support`,
      chatUrl: `${baseUrl}/chat`
    };
  }

  /**
   * Enviar email via AWS SES
   */
  async sendEmail(options) {
    const params = {
      Source: `${this.fromName} <${this.fromEmail}>`,
      Destination: {
        ToAddresses: Array.isArray(options.to) ? options.to : [options.to],
        CcAddresses: options.cc || [],
        BccAddresses: options.bcc || []
      },
      Message: {
        Subject: {
          Data: options.subject,
          Charset: 'UTF-8'
        },
        Body: {}
      },
      ReplyToAddresses: options.replyTo ? [options.replyTo] : []
    };

    // Adicionar corpo HTML
    if (options.html) {
      params.Message.Body.Html = {
        Data: options.html,
        Charset: 'UTF-8'
      };
    }

    // Adicionar corpo texto
    if (options.text) {
      params.Message.Body.Text = {
        Data: options.text,
        Charset: 'UTF-8'
      };
    }

    try {
      const result = await ses.sendEmail(params).promise();
      console.log(`Email enviado com sucesso: ${result.MessageId}`);
      return result;
    } catch (error) {
      console.error('Erro ao enviar email:', error);
      throw error;
    }
  }

  /**
   * Enviar convite para cliente
   */
  async sendClientInvitation(invitation, tenant) {
    const urls = this.generateTenantUrls(tenant);
    const inviteUrl = `${urls.baseUrl}/invite/${invitation.token}`;

    const templateData = {
      clientName: invitation.name || 'Cliente',
      companyName: tenant.companyName,
      inviterName: invitation.invitedBy.name,
      inviteUrl,
      loginUrl: urls.loginUrl,
      supportUrl: urls.supportUrl,
      personalMessage: invitation.personalMessage,
      expiresIn: '30 dias',
      year: new Date().getFullYear()
    };

    try {
      // Compilar template
      const template = await this.compileTemplate('client-invitation');
      const html = template(templateData);

      // Enviar email
      await this.sendEmail({
        to: invitation.email,
        subject: `Convite para acessar o suporte da ${tenant.companyName}`,
        html,
        text: `Você foi convidado para acessar o suporte da ${tenant.companyName}. Acesse: ${inviteUrl}`
      });

      // Marcar como enviado
      invitation.emailSent = true;
      invitation.emailSentAt = new Date();
      await invitation.save();

      return true;
    } catch (error) {
      console.error('Erro ao enviar convite:', error);
      throw error;
    }
  }

  /**
   * Enviar email de boas-vindas para admin (após compra via Stripe)
   */
  async sendAdminWelcome(admin, tenant, temporaryPassword) {
    const urls = this.generateTenantUrls(tenant);
    const setupUrl = `${urls.baseUrl}/setup?token=${admin.invitationToken}`;

    const templateData = {
      adminName: admin.name,
      companyName: tenant.companyName,
      email: admin.email,
      temporaryPassword,
      setupUrl,
      dashboardUrl: urls.dashboardUrl,
      features: this.getPlanFeatures(tenant.subscription.plan),
      plan: tenant.subscription.plan,
      trialDays: process.env.DEFAULT_TENANT_TRIAL_DAYS || 14,
      year: new Date().getFullYear()
    };

    try {
      const template = await this.compileTemplate('admin-welcome');
      const html = template(templateData);

      await this.sendEmail({
        to: admin.email,
        subject: `Bem-vindo ao Chat Support - Configure sua empresa`,
        html,
        text: `Bem-vindo! Acesse ${setupUrl} para configurar sua empresa.`
      });

      return true;
    } catch (error) {
      console.error('Erro ao enviar email de boas-vindas:', error);
      throw error;
    }
  }

  /**
   * Enviar email quando Master cria um admin
   */
  async sendAdminCreatedByMaster(admin, tenant, password) {
    const urls = this.generateTenantUrls(tenant);

    const templateData = {
      adminName: admin.name,
      companyName: tenant.companyName,
      email: admin.email,
      password,
      loginUrl: urls.loginUrl,
      dashboardUrl: urls.dashboardUrl,
      year: new Date().getFullYear()
    };

    try {
      const template = await this.compileTemplate('admin-created-master');
      const html = template(templateData);

      await this.sendEmail({
        to: admin.email,
        subject: `Sua conta de administrador foi criada - ${tenant.companyName}`,
        html,
        text: `Sua conta foi criada. Email: ${admin.email}, Senha: ${password}`
      });

      return true;
    } catch (error) {
      console.error('Erro ao enviar email de admin criado:', error);
      throw error;
    }
  }

  /**
   * Enviar email quando agent é criado pelo admin
   */
  async sendAgentWelcome(agent, tenant, password) {
    const urls = this.generateTenantUrls(tenant);

    const templateData = {
      agentName: agent.name,
      companyName: tenant.companyName,
      email: agent.email,
      password,
      loginUrl: urls.loginUrl,
      department: agent.department,
      year: new Date().getFullYear()
    };

    try {
      const template = await this.compileTemplate('agent-welcome');
      const html = template(templateData);

      await this.sendEmail({
        to: agent.email,
        subject: `Bem-vindo à equipe de suporte - ${tenant.companyName}`,
        html,
        text: `Você foi adicionado como agente. Email: ${agent.email}, Senha: ${password}`
      });

      return true;
    } catch (error) {
      console.error('Erro ao enviar email de agente:', error);
      throw error;
    }
  }

  /**
   * Enviar notificação para Master sobre nova empresa
   */
  async sendMasterNotification(type, data) {
    const masterEmail = process.env.MASTER_EMAIL;
    if (!masterEmail) return;

    const templates = {
      'new-purchase': 'master-new-purchase',
      'tenant-suspended': 'master-tenant-suspended',
      'payment-failed': 'master-payment-failed'
    };

    const templateName = templates[type];
    if (!templateName) return;

    try {
      const template = await this.compileTemplate(templateName);
      const html = template(data);

      await this.sendEmail({
        to: masterEmail,
        subject: `[Master] ${type.replace('-', ' ').toUpperCase()} - ${data.companyName || 'Sistema'}`,
        html
      });

      return true;
    } catch (error) {
      console.error('Erro ao enviar notificação master:', error);
      // Não propagar erro para não afetar o fluxo principal
      return false;
    }
  }

  /**
   * Obter features do plano
   */
  getPlanFeatures(plan) {
    const features = {
      trial: ['Chat ilimitado', '1 Agente', '14 dias grátis'],
      starter: ['Chat ilimitado', '3 Agentes', 'Suporte por email'],
      professional: ['Chat ilimitado', '10 Agentes', 'Integrações', 'Suporte prioritário'],
      enterprise: ['Chat ilimitado', 'Agentes ilimitados', 'API completa', 'Suporte 24/7', 'SLA']
    };

    return features[plan] || features.trial;
  }

  /**
   * Enviar email de teste
   */
  async sendTestEmail(to) {
    try {
      await this.sendEmail({
        to,
        subject: 'Email de Teste - AWS SES',
        html: '<h1>Email de teste</h1><p>AWS SES está funcionando corretamente!</p>',
        text: 'Email de teste - AWS SES está funcionando!'
      });
      return true;
    } catch (error) {
      console.error('Erro no email de teste:', error);
      throw error;
    }
  }

  /**
   * Verificar domínio no SES (para produção)
   */
  async verifyDomain(domain) {
    try {
      const params = {
        Domain: domain,
        DkimEnabled: true
      };

      const result = await ses.verifyDomainDkim(params).promise();
      console.log('Domínio verificado:', result);
      return result;
    } catch (error) {
      console.error('Erro ao verificar domínio:', error);
      throw error;
    }
  }

  /**
   * Obter estatísticas de envio
   */
  async getSendStatistics() {
    try {
      const result = await ses.getSendStatistics().promise();
      return result.SendDataPoints;
    } catch (error) {
      console.error('Erro ao obter estatísticas:', error);
      throw error;
    }
  }
}

// Exportar instância única
module.exports = new EmailService();
