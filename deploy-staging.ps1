# Deploy Staging Script - Seguro
# ATENÇÃO: Configure as variáveis de ambiente antes de executar este script
# Use o arquivo .env.local ou defina as variáveis no sistema

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " DEPLOY STAGING - AMBIENTE SEGURO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Validar variáveis de ambiente necessárias
$requiredVars = @(
    "MONGODB_URI_STAGING",
    "JWT_SECRET",
    "EC2_HOST",
    "SSH_KEY_PATH"
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

# Criar arquivo .env temporário (sem senhas hardcoded)
$envContent = @"
NODE_ENV=staging
PORT=3001
MONGODB_URI=$($env:MONGODB_URI_STAGING)
JWT_SECRET=$($env:JWT_SECRET)
JWT_EXPIRE=7d
USE_S3=true
AWS_ACCESS_KEY_ID=$AWS_KEY
AWS_SECRET_ACCESS_KEY=$AWS_SECRET
S3_BUCKET_NAME=$($env:S3_BUCKET_NAME_STAGING)
AWS_REGION=us-east-1
CORS_ORIGIN=http://${SERVER_IP}:3000
CLIENT_URL=http://${SERVER_IP}:3000
API_URL=http://${SERVER_IP}:3001/api
"@

$envContent | Out-File -FilePath ".env.staging.server" -Encoding UTF8

Write-Host "Copiando arquivos..." -ForegroundColor Yellow

# Copiar .env
scp -i $SSH_KEY -o StrictHostKeyChecking=no .env.staging.server "ec2-user@${SERVER_IP}:~/"

# Executar comandos no servidor
Write-Host "Configurando servidor..." -ForegroundColor Yellow

ssh -i $SSH_KEY -o StrictHostKeyChecking=no "ec2-user@$SERVER_IP" @'
# Criar diretório staging
mkdir -p ~/chat-atendimento-staging
mv ~/.env.staging.server ~/chat-atendimento-staging/.env

# Ir para o diretório
cd ~/chat-atendimento-staging

# Verificar se tem arquivos
if [ ! -f "docker-compose.staging.yml" ]; then
    echo "Copiando arquivos do diretório principal..."
    cp -r ~/chat-atendimento/* ~/chat-atendimento-staging/ 2>/dev/null || true
fi

# Criar docker-compose simplificado para staging
cat > docker-compose.staging.yml << 'EOFDOCKER'
version: '3.8'

services:
  backend-staging:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: chat-backend-staging
    restart: unless-stopped
    env_file:
      - .env
    ports:
      - "3001:3001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend-staging:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        VITE_API_URL: http://52.90.17.204:3001/api
        VITE_SOCKET_URL: http://52.90.17.204:3001
    container_name: chat-frontend-staging
    restart: unless-stopped
    ports:
      - "3000:80"
    depends_on:
      - backend-staging
EOFDOCKER

# Parar containers antigos se existirem
docker stop chat-backend-staging chat-frontend-staging 2>/dev/null || true
docker rm chat-backend-staging chat-frontend-staging 2>/dev/null || true

# Build e iniciar
echo "Iniciando build..."
docker-compose -f docker-compose.staging.yml up -d --build

# Aguardar
sleep 20

# Verificar status
echo ""
echo "=== Status dos Containers ==="
docker ps | grep staging

echo ""
echo "=== Testando Backend ==="
curl -s http://localhost:3001/health || echo "Backend ainda iniciando..."
'@

Write-Host ""
Write-Host "Deploy STAGING concluido!" -ForegroundColor Green
Write-Host ""
Write-Host "URLs:" -ForegroundColor Cyan
Write-Host "Frontend: http://52.90.17.204:3000" -ForegroundColor White
Write-Host "Backend API: http://52.90.17.204:3001" -ForegroundColor White
Write-Host "Health Check: http://52.90.17.204:3001/health" -ForegroundColor White
