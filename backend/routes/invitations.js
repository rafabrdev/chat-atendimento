const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Invitation = require('../models/Invitation');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const { conditionalLoadTenant } = require('../middleware/conditionalTenant');
const { sendInvitationEmail } = require('../utils/emailService');

// Aplicar middleware de autenticação e tenant
router.use(authMiddleware);
router.use(conditionalLoadTenant);

/**
 * Enviar convite
 * POST /api/invitations/send
 */
router.post('/send', async (req, res) => {
  try {
    const { email, name, role, department } = req.body;
    
    // Validar permissão: admin pode convidar agentes e clientes, agentes só podem convidar clientes
    if (req.user.role === 'agent' && role === 'agent') {
      return res.status(403).json({
        success: false,
        message: 'Agentes não podem convidar outros agentes'
      });
    }
    
    if (req.user.role === 'client') {
      return res.status(403).json({
        success: false,
        message: 'Clientes não podem enviar convites'
      });
    }
    
    // Verificar se já existe usuário com este email no tenant
    const existingUser = await User.findOne({
      email: email.toLowerCase(),
      tenantId: req.tenantId
    });
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Usuário já existe neste tenant'
      });
    }
    
    // Verificar se já existe convite pendente
    const existingInvite = await Invitation.findOne({
      email: email.toLowerCase(),
      tenantId: req.tenantId,
      status: 'pending'
    });
    
    if (existingInvite && existingInvite.isValid()) {
      return res.status(400).json({
        success: false,
        message: 'Já existe um convite pendente para este email'
      });
    }
    
    // Criar novo convite
    const invitation = await Invitation.create({
      tenantId: req.tenantId,
      email: email.toLowerCase(),
      name,
      role,
      department,
      invitedBy: req.user._id,
      token: crypto.randomBytes(32).toString('hex')
    });
    
    // Gerar link de convite
    const inviteLink = `${process.env.FRONTEND_URL}/register?invite=${invitation.token}`;
    
    // Enviar email (se configurado)
    if (process.env.SMTP_HOST) {
      try {
        await sendInvitationEmail({
          to: email,
          inviterName: req.user.name,
          companyName: req.user.company,
          role,
          inviteLink
        });
      } catch (emailError) {
        console.error('Erro ao enviar email de convite:', emailError);
        // Não falhar a requisição se o email falhar
      }
    }
    
    res.status(201).json({
      success: true,
      message: 'Convite enviado com sucesso',
      invitation: {
        id: invitation._id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt
      },
      inviteLink
    });
  } catch (error) {
    console.error('Erro ao enviar convite:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao enviar convite'
    });
  }
});

/**
 * Validar convite
 * GET /api/invitations/validate/:token
 */
router.get('/validate/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    const invitation = await Invitation.findOne({ token })
      .populate('tenantId', 'name companyName')
      .populate('invitedBy', 'name email');
    
    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Convite não encontrado'
      });
    }
    
    if (!invitation.isValid()) {
      return res.status(400).json({
        success: false,
        message: 'Convite expirado ou já utilizado'
      });
    }
    
    res.json({
      success: true,
      invitation: {
        email: invitation.email,
        name: invitation.name,
        role: invitation.role,
        department: invitation.department,
        tenant: {
          id: invitation.tenantId._id,
          name: invitation.tenantId.companyName || invitation.tenantId.name
        },
        invitedBy: {
          name: invitation.invitedBy.name,
          email: invitation.invitedBy.email
        },
        expiresAt: invitation.expiresAt
      }
    });
  } catch (error) {
    console.error('Erro ao validar convite:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao validar convite'
    });
  }
});

/**
 * Listar convites do tenant
 * GET /api/invitations/list
 */
router.get('/list', async (req, res) => {
  try {
    // Apenas admin pode ver todos os convites
    if (req.user.role !== 'admin' && req.user.role !== 'master') {
      return res.status(403).json({
        success: false,
        message: 'Sem permissão para listar convites'
      });
    }
    
    const { status, page = 1, limit = 20 } = req.query;
    
    const query = {
      tenantId: req.tenantId,
      ...(status && { status })
    };
    
    const invitations = await Invitation.find(query)
      .populate('invitedBy', 'name email')
      .populate('usedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await Invitation.countDocuments(query);
    
    res.json({
      success: true,
      invitations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Erro ao listar convites:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar convites'
    });
  }
});

/**
 * Cancelar convite
 * DELETE /api/invitations/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Apenas admin pode cancelar convites
    if (req.user.role !== 'admin' && req.user.role !== 'master') {
      return res.status(403).json({
        success: false,
        message: 'Sem permissão para cancelar convites'
      });
    }
    
    const invitation = await Invitation.findOne({
      _id: id,
      tenantId: req.tenantId
    });
    
    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Convite não encontrado'
      });
    }
    
    if (invitation.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Apenas convites pendentes podem ser cancelados'
      });
    }
    
    await invitation.cancel();
    
    res.json({
      success: true,
      message: 'Convite cancelado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao cancelar convite:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao cancelar convite'
    });
  }
});

/**
 * Reenviar convite
 * POST /api/invitations/:id/resend
 */
router.post('/:id/resend', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Apenas admin pode reenviar convites
    if (req.user.role !== 'admin' && req.user.role !== 'master') {
      return res.status(403).json({
        success: false,
        message: 'Sem permissão para reenviar convites'
      });
    }
    
    const invitation = await Invitation.findOne({
      _id: id,
      tenantId: req.tenantId,
      status: 'pending'
    });
    
    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Convite não encontrado ou já foi utilizado'
      });
    }
    
    // Renovar data de expiração
    invitation.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await invitation.save();
    
    // Gerar link de convite
    const inviteLink = `${process.env.FRONTEND_URL}/register?invite=${invitation.token}`;
    
    // Reenviar email
    if (process.env.SMTP_HOST) {
      try {
        await sendInvitationEmail({
          to: invitation.email,
          inviterName: req.user.name,
          companyName: req.user.company,
          role: invitation.role,
          inviteLink
        });
      } catch (emailError) {
        console.error('Erro ao reenviar email de convite:', emailError);
      }
    }
    
    res.json({
      success: true,
      message: 'Convite reenviado com sucesso',
      inviteLink
    });
  } catch (error) {
    console.error('Erro ao reenviar convite:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao reenviar convite'
    });
  }
});

module.exports = router;
