# Deploy Production Script - Seguro
# ATENÇÃO: Este é o ambiente de PRODUÇÃO!
# Configure as variáveis de ambiente antes de executar este script

Write-Host "" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Red
Write-Host " 🚀 DEPLOY PRODUÇÃO - AMBIENTE SEGURO" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Red
Write-Host "⚠️  ATENÇÃO: Este é o ambiente de PRODUÇÃO!" -ForegroundColor Yellow
Write-Host ""

# Validação de segurança
$confirm = Read-Host "Tem certeza que deseja fazer deploy em PRODUÇÃO? (yes/no)"
if ($confirm -ne "yes") {
    Write-Host "Deploy cancelado." -ForegroundColor Yellow
    exit
}

# Validar variáveis de ambiente necessárias
$requiredVars = @(
    "MONGODB_URI_PRODUCTION",
    "JWT_SECRET",
    "EC2_HOST",
    "SSH_KEY_PATH",
    "S3_BUCKET_NAME_PRODUCTION"
)

$missingVars = @()
foreach ($var in $requiredVars) {
    if (-not (Get-Item Env:$var -ErrorAction SilentlyContinue)) {
        $missingVars += $var
    }
}

if ($missingVars.Count -gt 0) {
    Write-Host "❌ ERRO: Variáveis de ambiente não configuradas:" -ForegroundColor Red
    foreach ($var in $missingVars) {
        Write-Host "   - $var" -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "Configure as variáveis usando um dos métodos:" -ForegroundColor Yellow
    Write-Host "1. Arquivo .env.local (recomendado)" -ForegroundColor White
    Write-Host "2. Variáveis de ambiente do sistema" -ForegroundColor White
    Write-Host "3. Execute: .\setup-env.ps1" -ForegroundColor White
    Write-Host ""
    Write-Host "⚠️  IMPORTANTE: Não coloque senhas diretamente no código!" -ForegroundColor Red
    exit 1
}

# Carregar configurações
$SERVER_IP = $env:EC2_HOST
if (-not $SERVER_IP) { $SERVER_IP = "52.90.17.204" }

$SSH_KEY = $env:SSH_KEY_PATH
if (-not $SSH_KEY) { $SSH_KEY = "$HOME\.ssh\chat-atendimento-new-key.pem" }

# Obter credenciais AWS
$AWS_KEY = $env:AWS_ACCESS_KEY_ID
if (-not $AWS_KEY) { $AWS_KEY = aws configure get aws_access_key_id }

$AWS_SECRET = $env:AWS_SECRET_ACCESS_KEY
if (-not $AWS_SECRET) { $AWS_SECRET = aws configure get aws_secret_access_key }

# Confirmação final com detalhes
Write-Host ""
Write-Host "🔍 Configurações de Deploy:" -ForegroundColor Cyan
Write-Host "   Servidor: $SERVER_IP" -ForegroundColor White
Write-Host "   Ambiente: PRODUÇÃO" -ForegroundColor Red
Write-Host "   MongoDB: [PROTEGIDO]" -ForegroundColor White
Write-Host "   S3 Bucket: $($env:S3_BUCKET_NAME_PRODUCTION)" -ForegroundColor White
Write-Host ""

$finalConfirm = Read-Host "Confirmar deploy de PRODUÇÃO com estas configurações? (yes/no)"
if ($finalConfirm -ne "yes") {
    Write-Host "Deploy cancelado." -ForegroundColor Yellow
    exit
}

# Criar arquivo .env temporário (sem senhas hardcoded)
$envContent = @"
NODE_ENV=production
PORT=3002
MONGODB_URI=$($env:MONGODB_URI_PRODUCTION)
JWT_SECRET=$($env:JWT_SECRET)
JWT_EXPIRE=7d
USE_S3=true
AWS_ACCESS_KEY_ID=$AWS_KEY
AWS_SECRET_ACCESS_KEY=$AWS_SECRET
S3_BUCKET_NAME=$($env:S3_BUCKET_NAME_PRODUCTION)
AWS_REGION=us-east-1
CORS_ORIGIN=https://suporte.brsi.net.br
CLIENT_URL=https://suporte.brsi.net.br
API_URL=https://suporte.brsi.net.br/api
"@

$envContent | Out-File -FilePath ".env.production.server" -Encoding UTF8

Write-Host "📝 Arquivo .env.production.server criado" -ForegroundColor Yellow

# Copiar arquivo para o servidor
Write-Host "📦 Copiando configurações para o servidor..." -ForegroundColor Yellow
scp -i $SSH_KEY -o StrictHostKeyChecking=no .env.production.server "ec2-user@${SERVER_IP}:~/"

# Executar comandos no servidor
Write-Host "🔧 Configurando ambiente de produção no servidor..." -ForegroundColor Yellow

ssh -i $SSH_KEY -o StrictHostKeyChecking=no "ec2-user@$SERVER_IP" @'
# Criar diretório production
mkdir -p ~/chat-atendimento-production
mv ~/.env.production.server ~/chat-atendimento-production/.env

# Ir para o diretório
cd ~/chat-atendimento-production

# Verificar se tem arquivos
if [ ! -f "docker-production.yml" ]; then
    echo "Copiando arquivos do repositório principal..."
    cp -r ~/chat-atendimento/* ~/chat-atendimento-production/ 2>/dev/null || true
fi

# Criar docker-compose para produção
cat > docker-production.yml << 'EOFDOCKER'
version: '3.8'

services:
  backend-production:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: chat-backend-production
    restart: always
    env_file:
      - .env
    ports:
      - "3002:3002"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3002/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  frontend-production:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        VITE_API_URL: https://suporte.brsi.net.br/api
        VITE_SOCKET_URL: https://suporte.brsi.net.br
    container_name: chat-frontend-production
    restart: always
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - backend-production
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
EOFDOCKER

# Fazer backup se existir deployment anterior
if [ -f "docker-production.yml" ]; then
    echo "Fazendo backup do deployment anterior..."
    docker-compose -f docker-production.yml down 2>/dev/null || true
    mkdir -p backups
    cp docker-production.yml backups/docker-production-$(date +%Y%m%d-%H%M%S).yml
fi

# Parar containers antigos
docker stop chat-backend-production chat-frontend-production 2>/dev/null || true
docker rm chat-backend-production chat-frontend-production 2>/dev/null || true

# Build e iniciar produção
echo "Iniciando build de PRODUÇÃO..."
docker-compose -f docker-production.yml up -d --build

# Aguardar inicialização
sleep 20

# Verificar status
echo ""
echo "=== Status dos Containers de PRODUÇÃO ==="
docker ps | grep production

echo ""
echo "=== Testando Backend de PRODUÇÃO ==="
curl -s http://localhost:3002/health || echo "Backend ainda iniciando..."

echo ""
echo "=== Logs do Backend ==="
docker logs --tail 20 chat-backend-production
'@

Write-Host ""
Write-Host "✅ Deploy de PRODUÇÃO concluído!" -ForegroundColor Green
Write-Host ""
Write-Host "URLs de PRODUÇÃO:" -ForegroundColor Cyan
Write-Host "Frontend: https://suporte.brsi.net.br (após configurar DNS)" -ForegroundColor White
Write-Host "Backend API: http://52.90.17.204:3002" -ForegroundColor White
Write-Host "Health Check: http://52.90.17.204:3002/health" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  IMPORTANTE: Configure o DNS no Hostinger para apontar para 52.90.17.204" -ForegroundColor Yellow
