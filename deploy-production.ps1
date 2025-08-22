# Deploy Production Script
Write-Host "🚀 Iniciando deploy de PRODUÇÃO..." -ForegroundColor Red
Write-Host "⚠️  ATENÇÃO: Este é o ambiente de PRODUÇÃO!" -ForegroundColor Yellow

# Confirmação
$confirm = Read-Host "Tem certeza que deseja fazer deploy em PRODUÇÃO? (yes/no)"
if ($confirm -ne "yes") {
    Write-Host "Deploy cancelado." -ForegroundColor Yellow
    exit
}

$SERVER_IP = "52.90.17.204"
$SSH_KEY = "$HOME\.ssh\chat-atendimento-new-key.pem"

# Obter credenciais AWS
$AWS_KEY = aws configure get aws_access_key_id
$AWS_SECRET = aws configure get aws_secret_access_key

# Criar arquivo .env para produção
$envContent = @"
NODE_ENV=production
PORT=3002
MONGODB_URI=mongodb+srv://chatadmin:9CG4miPXFSwJP562@chat-atendimento.7mtwmy0.mongodb.net/chat-atendimento-prod?retryWrites=true&w=majority
JWT_SECRET=xK9@mP2$vN7#qR4&wY6*bT8!sF3^jL5
JWT_EXPIRE=7d
USE_S3=true
AWS_ACCESS_KEY_ID=$AWS_KEY
AWS_SECRET_ACCESS_KEY=$AWS_SECRET
S3_BUCKET_NAME=chat-atendimento-production
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
