# Correções Completas do Sistema Multi-Tenant

## 1. AGENTES - Adicionar tenantId

### Modelo Agent - Adicionar campo tenantId
```javascript
// models/Agent.js
tenantId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Tenant',
  required: true,
  index: true
}
```

### Controller Agent - Filtrar por tenantId
```javascript
// Todas as queries devem incluir tenantId
const query = { 
  tenantId: req.user.tenantId,
  ...otherFilters 
};
```

## 2. SISTEMA DE CONVITES

### Novo modelo Invitation
```javascript
// models/Invitation.js
const invitationSchema = new mongoose.Schema({
  tenantId: { type: ObjectId, ref: 'Tenant', required: true },
  email: { type: String, required: true },
  role: { type: String, enum: ['agent', 'client'], required: true },
  token: { type: String, unique: true, required: true },
  invitedBy: { type: ObjectId, ref: 'User', required: true },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date },
  status: { type: String, enum: ['pending', 'accepted', 'expired'], default: 'pending' }
});
```

### Rotas de convite
```javascript
// routes/invitations.js
POST /api/invitations/send - Enviar convite
GET /api/invitations/validate/:token - Validar convite
POST /api/invitations/accept/:token - Aceitar convite
GET /api/invitations/list - Listar convites do tenant
```

## 3. REGISTRO RESTRITO

### Modificar rota de registro público
```javascript
// routes/auth.js - registro público
router.post('/register', async (req, res) => {
  const { inviteToken } = req.body;
  
  // Se não tem token de convite, negar
  if (!inviteToken) {
    return res.status(403).json({
      success: false,
      message: 'Registro público não permitido. É necessário um convite.'
    });
  }
  
  // Validar token e pegar tenantId
  const invitation = await Invitation.findOne({ 
    token: inviteToken,
    status: 'pending',
    expiresAt: { $gt: Date.now() }
  });
  
  if (!invitation) {
    return res.status(400).json({
      success: false,
      message: 'Convite inválido ou expirado'
    });
  }
  
  // Criar usuário com tenantId do convite
  const user = await User.create({
    ...userData,
    tenantId: invitation.tenantId,
    role: invitation.role
  });
  
  // Marcar convite como usado
  invitation.status = 'accepted';
  invitation.usedAt = Date.now();
  await invitation.save();
});
```

## 4. LISTAGEM DE USUÁRIOS/CLIENTES

### Controller para listar clientes do tenant
```javascript
// controllers/userController.js
exports.getTenantUsers = async (req, res) => {
  const { role, page = 1, limit = 20 } = req.query;
  
  const query = {
    tenantId: req.user.tenantId,
    ...(role && { role })
  };
  
  const users = await User.find(query)
    .select('-password')
    .limit(limit)
    .skip((page - 1) * limit);
  
  res.json({ success: true, users });
};
```

## 5. ANALYTICS POR TENANT

### Garantir filtro em todas as métricas
```javascript
// controllers/analyticsController.js
const baseQuery = {
  tenantId: req.user.tenantId,
  ...dateFilters
};

// Todas as queries devem usar baseQuery
const conversations = await Conversation.find(baseQuery);
const messages = await Message.find(baseQuery);
```

## 6. FLUXO DE CADASTRO VIA STRIPE

### Após pagamento bem-sucedido
```javascript
// controllers/stripeController.js
exports.handleCheckoutSuccess = async (session) => {
  // Criar tenant
  const tenant = await Tenant.create({
    name: session.metadata.companyName,
    contactEmail: session.customer_email,
    plan: session.metadata.plan,
    stripeCustomerId: session.customer
  });
  
  // Criar admin
  const admin = await User.create({
    email: session.customer_email,
    name: session.metadata.adminName,
    role: 'admin',
    tenantId: tenant._id,
    password: generateTempPassword() // Enviar por email
  });
  
  // Enviar email com credenciais
  await sendWelcomeEmail(admin.email, {
    tempPassword,
    loginUrl: `${process.env.FRONTEND_URL}/login`
  });
};
```

## 7. MIDDLEWARE DE VALIDAÇÃO DE TENANT

### Garantir que usuário só acessa dados do seu tenant
```javascript
// middleware/validateTenantAccess.js
exports.validateTenantAccess = (Model) => {
  return async (req, res, next) => {
    const resourceId = req.params.id;
    
    if (!resourceId) return next();
    
    const resource = await Model.findById(resourceId);
    
    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    
    if (resource.tenantId?.toString() !== req.user.tenantId?.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    req.resource = resource;
    next();
  };
};
```

## 8. PAINEL ADMIN - Métricas do Tenant

### Dashboard com dados isolados
```javascript
// controllers/dashboardController.js
exports.getTenantDashboard = async (req, res) => {
  const tenantId = req.user.tenantId;
  
  const [
    totalUsers,
    totalAgents,
    totalConversations,
    activeConversations,
    avgResponseTime,
    satisfaction
  ] = await Promise.all([
    User.countDocuments({ tenantId, role: 'client' }),
    User.countDocuments({ tenantId, role: 'agent' }),
    Conversation.countDocuments({ tenantId }),
    Conversation.countDocuments({ tenantId, status: 'active' }),
    calculateAvgResponseTime(tenantId),
    calculateSatisfaction(tenantId)
  ]);
  
  res.json({
    success: true,
    metrics: {
      totalUsers,
      totalAgents,
      totalConversations,
      activeConversations,
      avgResponseTime,
      satisfaction
    }
  });
};
```

## 9. ROTAS MASTER

### Apenas master pode criar tenants
```javascript
// routes/master.js
router.post('/tenants', requireRole('master'), async (req, res) => {
  const tenant = await Tenant.create(req.body);
  
  // Criar admin para o tenant
  const admin = await User.create({
    ...req.body.admin,
    tenantId: tenant._id,
    role: 'admin'
  });
  
  res.json({ tenant, admin });
});
```

## 10. FRONTEND - Links de convite

### Componente de convite
```jsx
// components/InviteUser.jsx
const InviteUser = () => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('client');
  
  const sendInvite = async () => {
    const { data } = await api.post('/api/invitations/send', {
      email,
      role
    });
    
    // Link gerado: ${FRONTEND_URL}/register?invite=${data.token}
    navigator.clipboard.writeText(data.inviteLink);
    toast.success('Link copiado!');
  };
  
  return (
    <div>
      <input value={email} onChange={(e) => setEmail(e.target.value)} />
      <select value={role} onChange={(e) => setRole(e.target.value)}>
        <option value="client">Cliente</option>
        <option value="agent">Agente</option>
      </select>
      <button onClick={sendInvite}>Enviar Convite</button>
    </div>
  );
};
```
