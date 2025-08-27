const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token de acesso não fornecido'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Buscar usuário completo do banco incluindo tenantId
    const user = await User.findById(decoded.id)
      .select('-password')
      .populate('tenantId', 'slug companyName isActive');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Conta desativada'
      });
    }

    // Garantir que req.user tem tenantId (usar do token se não existir no banco)
    req.user = user;
    if (!req.user.tenantId && decoded.tenantId) {
      req.user.tenantId = decoded.tenantId;
    }
    
    // Adicionar informações extras do token decodificado
    req.user.tokenData = decoded;
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({
      success: false,
      message: 'Token inválido'
    });
  }
};

// Middleware para verificar roles específicas
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado para este tipo de usuário'
      });
    }
    next();
  };
};

module.exports = { auth, authorize };
