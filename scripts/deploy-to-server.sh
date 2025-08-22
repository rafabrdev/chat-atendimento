#!/bin/bash

# Script de Deploy para Servidor EC2
# Este script configura staging e production com portas diferentes

echo "🚀 Iniciando deploy no servidor..."

# Configuração
SERVER_IP="52.90.17.204"
SSH_KEY="$HOME/.ssh/chat-atendimento-new-key.pem"

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Escolha o ambiente:${NC}"
echo "1) Staging (portas 3000/3001)"
echo "2) Production (portas 80/443/3002)"
read -p "Opção: " ENV_CHOICE

if [ "$ENV_CHOICE" == "1" ]; then
    ENV="staging"
    COMPOSE_FILE="docker-compose.staging.yml"
    CONTAINER_PREFIX="staging"
    FRONTEND_PORT="3000:80"
    BACKEND_PORT="3001:3001"
    MONGODB_URI="${MONGODB_URI_STAGING}"
    S3_BUCKET="chat-atendimento-staging"
    USE_S3="true"
elif [ "$ENV_CHOICE" == "2" ]; then
    ENV="production"
    COMPOSE_FILE="docker-compose.production.yml"
    CONTAINER_PREFIX="prod"
    FRONTEND_PORT="80:80"
    BACKEND_PORT="3002:3001"
    MONGODB_URI="${MONGODB_URI_PROD}"
    S3_BUCKET="chat-atendimento-production"
    USE_S3="true"
else
    echo -e "${RED}Opção inválida!${NC}"
    exit 1
fi

echo -e "${GREEN}Configurando ambiente: $ENV${NC}"

# Criar arquivo .env no servidor
cat > .env.$ENV << EOF
# $ENV Environment
NODE_ENV=$ENV
MONGODB_URI=$MONGODB_URI
JWT_SECRET=${JWT_SECRET}
AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
S3_BUCKET_NAME=$S3_BUCKET
AWS_REGION=us-east-1
USE_S3=$USE_S3
FRONTEND_PORT=$FRONTEND_PORT
BACKEND_PORT=$BACKEND_PORT
EOF

# Copiar arquivos para o servidor
echo "📦 Copiando arquivos..."
scp -i "$SSH_KEY" -r \
    .env.$ENV \
    docker-compose.$ENV.yml \
    backend \
    frontend \
    ec2-user@$SERVER_IP:~/chat-atendimento-$ENV/

# Executar deploy no servidor
echo "🔧 Executando deploy..."
ssh -i "$SSH_KEY" ec2-user@$SERVER_IP << ENDSSH
    cd ~/chat-atendimento-$ENV
    
    # Parar containers antigos
    docker-compose -f docker-compose.$ENV.yml down
    
    # Limpar imagens antigas
    docker system prune -f
    
    # Iniciar novos containers
    docker-compose -f docker-compose.$ENV.yml --env-file .env.$ENV up -d --build
    
    # Verificar status
    sleep 10
    docker ps | grep $CONTAINER_PREFIX
    
    echo "✅ Deploy $ENV concluído!"
ENDSSH

echo -e "${GREEN}Deploy finalizado!${NC}"
echo "Acesse:"
if [ "$ENV" == "staging" ]; then
    echo "Frontend: http://$SERVER_IP:3000"
    echo "Backend: http://$SERVER_IP:3001"
else
    echo "Frontend: http://$SERVER_IP"
    echo "Backend: http://$SERVER_IP:3002"
fi
