const express = require('express');
const router = express.Router();
const stripeService = require('../services/stripeService');

/**
 * Página de compra com produtos embedded
 * Acesse: http://localhost:5000/buy
 */
router.get('/', (req, res) => {
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
  
  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Escolha seu Plano - Chat Support Platform</title>
    <script src="https://js.stripe.com/v3/"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 20px;
        }
        
        .header {
            text-align: center;
            color: white;
            margin-bottom: 40px;
            animation: fadeIn 1s ease-in;
        }
        
        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
        }
        
        .header p {
            font-size: 1.2rem;
            opacity: 0.95;
        }
        
        .container {
            display: flex;
            gap: 30px;
            flex-wrap: wrap;
            justify-content: center;
            max-width: 1200px;
            width: 100%;
        }
        
        .plan-card {
            background: white;
            border-radius: 20px;
            padding: 40px 30px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
            flex: 1;
            min-width: 280px;
            max-width: 350px;
            position: relative;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
            animation: slideUp 0.6s ease-out;
        }
        
        .plan-card:hover {
            transform: translateY(-10px);
            box-shadow: 0 20px 60px rgba(0,0,0,0.15);
        }
        
        .plan-card.featured {
            border: 3px solid #667eea;
            transform: scale(1.05);
        }
        
        .plan-card.featured::before {
            content: "MAIS POPULAR";
            position: absolute;
            top: -15px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 5px 20px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: bold;
        }
        
        .plan-name {
            font-size: 1.8rem;
            font-weight: bold;
            color: #333;
            margin-bottom: 20px;
            text-align: center;
        }
        
        .plan-price {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .price-amount {
            font-size: 3rem;
            font-weight: bold;
            color: #667eea;
        }
        
        .price-currency {
            font-size: 1.5rem;
            color: #999;
        }
        
        .price-period {
            display: block;
            color: #666;
            margin-top: 5px;
            font-size: 0.9rem;
        }
        
        .features {
            list-style: none;
            margin-bottom: 30px;
        }
        
        .features li {
            padding: 12px 0;
            border-bottom: 1px solid #eee;
            color: #555;
            display: flex;
            align-items: center;
        }
        
        .features li:last-child {
            border-bottom: none;
        }
        
        .features li::before {
            content: "✓";
            color: #4CAF50;
            font-weight: bold;
            margin-right: 10px;
            font-size: 1.2rem;
        }
        
        .billing-toggle {
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-bottom: 20px;
        }
        
        .billing-option {
            display: flex;
            align-items: center;
            padding: 10px;
            border: 2px solid #e0e0e0;
            border-radius: 10px;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .billing-option:hover {
            border-color: #667eea;
            background: #f8f9ff;
        }
        
        .billing-option.selected {
            border-color: #667eea;
            background: #f8f9ff;
        }
        
        .billing-option input {
            margin-right: 10px;
        }
        
        .billing-label {
            flex: 1;
            font-weight: 500;
        }
        
        .billing-price {
            font-weight: bold;
            color: #667eea;
        }
        
        .savings {
            background: #4CAF50;
            color: white;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 0.75rem;
            margin-left: 10px;
        }
        
        .btn-buy {
            width: 100%;
            padding: 15px 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 1.1rem;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s ease;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .btn-buy:hover {
            transform: scale(1.05);
            box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
        }
        
        .btn-buy:disabled {
            background: #ccc;
            cursor: not-allowed;
            transform: none;
        }
        
        .loading {
            display: none;
            text-align: center;
            margin-top: 20px;
            color: #667eea;
        }
        
        .loading.show {
            display: block;
        }
        
        .error {
            background: #ff5252;
            color: white;
            padding: 15px;
            border-radius: 10px;
            margin-top: 20px;
            display: none;
        }
        
        .error.show {
            display: block;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .test-mode {
            background: #ff9800;
            color: white;
            padding: 10px;
            text-align: center;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 1000;
            font-weight: bold;
        }
        
        @media (max-width: 768px) {
            .container {
                flex-direction: column;
                align-items: center;
            }
            
            .plan-card {
                max-width: 100%;
            }
            
            .plan-card.featured {
                transform: none;
            }
        }
    </style>
</head>
<body>
    <div class="test-mode">
        🔒 MODO TESTE - Use o cartão: 4242 4242 4242 4242
    </div>
    
    <div class="header">
        <h1>Escolha o Plano Ideal para Sua Empresa</h1>
        <p>Sistema completo de atendimento via chat com gestão multi-tenant</p>
    </div>
    
    <div class="container">
        <!-- Plano Starter -->
        <div class="plan-card">
            <h2 class="plan-name">Starter</h2>
            <div class="plan-price">
                <span class="price-currency">R$</span>
                <span class="price-amount" id="price-starter">49</span>
                <span class="price-period" id="period-starter">/mês</span>
            </div>
            
            <ul class="features">
                <li>10 usuários</li>
                <li>3 agentes de suporte</li>
                <li>5 GB de armazenamento</li>
                <li>10.000 mensagens/mês</li>
                <li>Módulo Chat</li>
                <li>Suporte por email</li>
            </ul>
            
            <div class="billing-toggle">
                <div class="billing-option selected" onclick="selectBilling('starter', 'monthly', this)">
                    <input type="radio" name="billing-starter" value="monthly" checked>
                    <span class="billing-label">Mensal</span>
                    <span class="billing-price">R$ 49/mês</span>
                </div>
                <div class="billing-option" onclick="selectBilling('starter', 'yearly', this)">
                    <input type="radio" name="billing-starter" value="yearly">
                    <span class="billing-label">Anual</span>
                    <span class="billing-price">R$ 490/ano</span>
                    <span class="savings">Economize 17%</span>
                </div>
            </div>
            
            <button class="btn-buy" onclick="createCheckout('starter')" id="btn-starter">
                Começar Agora
            </button>
            <div class="loading" id="loading-starter">Processando...</div>
            <div class="error" id="error-starter"></div>
        </div>
        
        <!-- Plano Professional -->
        <div class="plan-card featured">
            <h2 class="plan-name">Professional</h2>
            <div class="plan-price">
                <span class="price-currency">R$</span>
                <span class="price-amount" id="price-professional">99</span>
                <span class="price-period" id="period-professional">/mês</span>
            </div>
            
            <ul class="features">
                <li>50 usuários</li>
                <li>10 agentes de suporte</li>
                <li>20 GB de armazenamento</li>
                <li>50.000 mensagens/mês</li>
                <li>Módulos Chat + CRM</li>
                <li>Suporte prioritário</li>
                <li>Integrações avançadas</li>
            </ul>
            
            <div class="billing-toggle">
                <div class="billing-option selected" onclick="selectBilling('professional', 'monthly', this)">
                    <input type="radio" name="billing-professional" value="monthly" checked>
                    <span class="billing-label">Mensal</span>
                    <span class="billing-price">R$ 99/mês</span>
                </div>
                <div class="billing-option" onclick="selectBilling('professional', 'yearly', this)">
                    <input type="radio" name="billing-professional" value="yearly">
                    <span class="billing-label">Anual</span>
                    <span class="billing-price">R$ 990/ano</span>
                    <span class="savings">Economize 17%</span>
                </div>
            </div>
            
            <button class="btn-buy" onclick="createCheckout('professional')" id="btn-professional">
                Começar Agora
            </button>
            <div class="loading" id="loading-professional">Processando...</div>
            <div class="error" id="error-professional"></div>
        </div>
        
        <!-- Plano Enterprise -->
        <div class="plan-card">
            <h2 class="plan-name">Enterprise</h2>
            <div class="plan-price">
                <span class="price-currency">R$</span>
                <span class="price-amount" id="price-enterprise">299</span>
                <span class="price-period" id="period-enterprise">/mês</span>
            </div>
            
            <ul class="features">
                <li>Usuários ilimitados</li>
                <li>Agentes ilimitados</li>
                <li>100 GB de armazenamento</li>
                <li>Mensagens ilimitadas</li>
                <li>Todos os módulos</li>
                <li>Suporte 24/7</li>
                <li>SLA garantido</li>
                <li>API completa</li>
            </ul>
            
            <div class="billing-toggle">
                <div class="billing-option selected" onclick="selectBilling('enterprise', 'monthly', this)">
                    <input type="radio" name="billing-enterprise" value="monthly" checked>
                    <span class="billing-label">Mensal</span>
                    <span class="billing-price">R$ 299/mês</span>
                </div>
                <div class="billing-option" onclick="selectBilling('enterprise', 'yearly', this)">
                    <input type="radio" name="billing-enterprise" value="yearly">
                    <span class="billing-label">Anual</span>
                    <span class="billing-price">R$ 2.990/ano</span>
                    <span class="savings">Economize 17%</span>
                </div>
            </div>
            
            <button class="btn-buy" onclick="createCheckout('enterprise')" id="btn-enterprise">
                Começar Agora
            </button>
            <div class="loading" id="loading-enterprise">Processando...</div>
            <div class="error" id="error-enterprise"></div>
        </div>
    </div>
    
    <script>
        const stripe = Stripe('${publishableKey}');
        const billingSelections = {
            starter: 'monthly',
            professional: 'monthly',
            enterprise: 'monthly'
        };
        
        function selectBilling(plan, cycle, element) {
            billingSelections[plan] = cycle;
            
            // Atualizar visual dos botões
            const options = element.parentElement.querySelectorAll('.billing-option');
            options.forEach(opt => opt.classList.remove('selected'));
            element.classList.add('selected');
            element.querySelector('input').checked = true;
            
            // Atualizar preço exibido
            const prices = {
                starter: { monthly: '49', yearly: '490' },
                professional: { monthly: '99', yearly: '990' },
                enterprise: { monthly: '299', yearly: '2.990' }
            };
            
            document.getElementById('price-' + plan).textContent = prices[plan][cycle];
            document.getElementById('period-' + plan).textContent = cycle === 'monthly' ? '/mês' : '/ano';
        }
        
        async function createCheckout(plan) {
            const button = document.getElementById('btn-' + plan);
            const loading = document.getElementById('loading-' + plan);
            const errorDiv = document.getElementById('error-' + plan);
            
            // Resetar erro
            errorDiv.classList.remove('show');
            errorDiv.textContent = '';
            
            // Mostrar loading
            button.disabled = true;
            loading.classList.add('show');
            
            try {
                // Criar sessão de checkout
                const response = await fetch('/api/stripe/create-checkout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        plan: plan,
                        billingCycle: billingSelections[plan]
                    })
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.message || 'Erro ao criar checkout');
                }
                
                // Redirecionar para o Stripe Checkout
                if (data.data && data.data.url) {
                    window.location.href = data.data.url;
                } else {
                    throw new Error('URL de checkout não recebida');
                }
                
            } catch (error) {
                console.error('Erro:', error);
                errorDiv.textContent = error.message || 'Erro ao processar pagamento. Tente novamente.';
                errorDiv.classList.add('show');
                button.disabled = false;
                loading.classList.remove('show');
            }
        }
    </script>
</body>
</html>
  `;
  
  res.send(html);
});

/**
 * Página de sucesso após checkout
 */
router.get('/success', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pagamento Confirmado!</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
        }
        
        .success-card {
            background: white;
            border-radius: 20px;
            padding: 60px;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0,0,0,0.2);
            max-width: 500px;
            animation: slideUp 0.6s ease-out;
        }
        
        .checkmark {
            width: 80px;
            height: 80px;
            margin: 0 auto 30px;
            background: #4CAF50;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: scaleIn 0.6s ease-out;
        }
        
        .checkmark::after {
            content: "✓";
            color: white;
            font-size: 50px;
            font-weight: bold;
        }
        
        h1 {
            color: #333;
            margin-bottom: 20px;
        }
        
        p {
            color: #666;
            font-size: 1.1rem;
            line-height: 1.8;
            margin-bottom: 30px;
        }
        
        .info {
            background: #f5f5f5;
            border-radius: 10px;
            padding: 20px;
            margin: 30px 0;
        }
        
        .info-title {
            font-weight: bold;
            color: #667eea;
            margin-bottom: 10px;
        }
        
        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        @keyframes scaleIn {
            from {
                transform: scale(0);
            }
            to {
                transform: scale(1);
            }
        }
    </style>
</head>
<body>
    <div class="success-card">
        <div class="checkmark"></div>
        <h1>Pagamento Confirmado!</h1>
        <p>Obrigado por assinar o Chat Support Platform!</p>
        
        <div class="info">
            <div class="info-title">📧 Próximos Passos:</div>
            <p>
                1. Verifique seu email para as credenciais de acesso<br>
                2. Complete a configuração da sua empresa<br>
                3. Convide sua equipe para começar a usar
            </p>
        </div>
        
        <p style="color: #999; font-size: 0.9rem;">
            Em caso de dúvidas, entre em contato com nosso suporte.
        </p>
    </div>
</body>
</html>
  `;
  
  res.send(html);
});

module.exports = router;
