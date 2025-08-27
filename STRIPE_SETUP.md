# 🚀 Configuração Completa do Stripe

## 📋 Pré-requisitos

1. Conta no Stripe (https://stripe.com)
2. Node.js instalado
3. Projeto rodando localmente

## 🔧 Passo 1: Instalar Stripe CLI

### Windows (Recomendado - usando Scoop)
```bash
# Instalar Scoop se não tiver
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
irm get.scoop.sh | iex

# Instalar Stripe CLI
scoop install stripe
```

### Alternativa - Download Manual
1. Baixe em: https://github.com/stripe/stripe-cli/releases
2. Extraia o arquivo
3. Adicione ao PATH do Windows

## 🔑 Passo 2: Configurar Chaves do Stripe

1. Acesse o Dashboard do Stripe: https://dashboard.stripe.com/test/apikeys
2. Copie suas chaves de **TESTE** (começam com `sk_test_` e `pk_test_`)
3. Adicione ao arquivo `backend/.env`:

```env
# Stripe Test Keys
STRIPE_SECRET_KEY=sk_test_51O...
STRIPE_PUBLISHABLE_KEY=pk_test_51O...
```

## 🎯 Passo 3: Fazer Login no Stripe CLI

```bash
stripe login
```
- Vai abrir o navegador
- Confirme o acesso
- Volte ao terminal

## 🔗 Passo 4: Configurar Webhook Local

Em um terminal separado, execute:

```bash
stripe listen --forward-to localhost:5000/api/stripe/webhook
```

**IMPORTANTE:** Copie o `webhook signing secret` que aparecerá:
```
Ready! Your webhook signing secret is whsec_xxxxx...
```

Adicione ao `.env`:
```env
STRIPE_WEBHOOK_SECRET=whsec_xxxxx...
```

## 📦 Passo 5: Criar Produtos no Stripe

```bash
cd backend
node scripts/stripeSetup.js
```

Escolha a opção 1 para criar os produtos.

**IMPORTANTE:** Após criar, o script mostrará os IDs dos preços. 
Você precisa atualizar o arquivo `backend/services/stripeService.js` com esses IDs:

```javascript
this.plans = {
  starter: {
    name: 'Starter',
    priceMonthly: 'price_xxx', // <-- Substitua com o ID real
    priceYearly: 'price_yyy',   // <-- Substitua com o ID real
    // ...
  }
}
```

## 🧪 Passo 6: Testar o Sistema

### Teste 1: Criar uma sessão de checkout

```bash
# No script de setup
node scripts/stripeSetup.js
# Escolha opção 2
```

Ou via API:
```bash
curl -X POST http://localhost:5000/api/stripe/create-checkout \
  -H "Content-Type: application/json" \
  -d '{
    "plan": "starter",
    "billingCycle": "monthly",
    "email": "teste@example.com"
  }'
```

### Teste 2: Simular eventos de webhook

Com o Stripe CLI rodando (`stripe listen`), em outro terminal:

```bash
# Simular checkout completo
stripe trigger checkout.session.completed

# Simular criação de assinatura
stripe trigger customer.subscription.created

# Simular pagamento bem-sucedido
stripe trigger invoice.payment_succeeded
```

## 🎨 Passo 7: Fluxo Completo

### Para Cliente Comprando:
1. Cliente acessa página de preços
2. Escolhe plano e clica em "Assinar"
3. É redirecionado para Stripe Checkout
4. Preenche dados e pagamento
5. Webhook recebe evento `checkout.session.completed`
6. Sistema cria automaticamente:
   - Tenant (empresa)
   - Admin com senha temporária
   - Envia email de boas-vindas
7. Cliente é redirecionado para completar cadastro

### Para Master (Você):
1. Acesse `/master` no frontend
2. Veja dashboard com todas as empresas
3. Crie empresas manualmente se quiser
4. Gerencie admins de cada empresa
5. Monitore pagamentos e uso

## 📊 Estrutura de Planos

### Starter - R$ 49/mês
- 10 usuários
- 3 agentes
- 5 GB armazenamento
- 10.000 mensagens/mês
- Módulo: Chat

### Professional - R$ 99/mês
- 50 usuários
- 10 agentes
- 20 GB armazenamento
- 50.000 mensagens/mês
- Módulos: Chat + CRM

### Enterprise - R$ 299/mês
- Usuários ilimitados
- Agentes ilimitados
- 100 GB armazenamento
- Mensagens ilimitadas
- Módulos: Chat + CRM + HRM

## 🔄 Migração para Produção

Quando estiver pronto para produção:

1. **No Stripe Dashboard:**
   - Ative sua conta
   - Configure dados bancários
   - Crie produtos em produção

2. **No .env de produção:**
```env
# Stripe Production Keys
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_prod_xxxxx
```

3. **Configure webhook em produção:**
   - No Stripe Dashboard > Webhooks
   - Adicione endpoint: `https://api.seudominio.com/api/stripe/webhook`
   - Selecione eventos:
     - `checkout.session.completed`
     - `customer.subscription.*`
     - `invoice.*`

## 🛠️ Troubleshooting

### Erro: "Invalid API Key"
- Verifique se as chaves no .env estão corretas
- Certifique-se de estar usando chaves de teste para desenvolvimento

### Webhook não funciona
- Verifique se o `stripe listen` está rodando
- Confirme que o STRIPE_WEBHOOK_SECRET está correto
- Certifique-se que o servidor está rodando na porta 5000

### Checkout não cria tenant
- Verifique os logs do servidor
- Confirme que o MongoDB está acessível
- Verifique se o webhook está recebendo eventos

## 📝 Comandos Úteis

```bash
# Ver logs de eventos do webhook
stripe logs tail

# Listar produtos
stripe products list

# Listar preços
stripe prices list

# Ver detalhes de uma sessão de checkout
stripe checkout sessions retrieve cs_test_xxxxx
```

## 🎯 Próximos Passos

1. ✅ Stripe configurado e testado
2. ⏳ Criar frontend do painel Master
3. ⏳ Criar página de preços
4. ⏳ Criar página de checkout success
5. ⏳ Criar sistema de convites
6. ⏳ Implementar templates de email

---

**Suporte:** Se tiver dúvidas, verifique os logs em `stripe logs tail` ou a documentação em https://stripe.com/docs
