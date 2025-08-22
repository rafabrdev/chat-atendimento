#!/bin/bash

# Script para gerenciar o fluxo de branches: develop → staging → main
# Autor: Chat Atendimento Team
# Uso: ./scripts/git-flow.sh [comando]

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Banner
echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     GIT FLOW - CHAT ATENDIMENTO        ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"

# Função para verificar branch atual
current_branch() {
    git branch --show-current
}

# Função para verificar se há mudanças não commitadas
check_clean() {
    if [[ -n $(git status -s) ]]; then
        echo -e "${RED}❌ Existem mudanças não commitadas!${NC}"
        echo "Por favor, commit ou stash suas mudanças antes de continuar."
        exit 1
    fi
}

# Função para atualizar branches
update_branches() {
    echo -e "${BLUE}📥 Atualizando branches...${NC}"
    git fetch origin
    
    # Atualizar develop
    git checkout develop 2>/dev/null || git checkout -b develop origin/develop
    git pull origin develop
    
    # Atualizar staging
    git checkout staging 2>/dev/null || git checkout -b staging origin/staging
    git pull origin staging
    
    # Atualizar main
    git checkout main
    git pull origin main
}

# Função para criar novo feature
new_feature() {
    echo -e "${YELLOW}🚀 Criar nova feature${NC}"
    read -p "Nome da feature (será criada como feature/nome): " feature_name
    
    if [[ -z "$feature_name" ]]; then
        echo -e "${RED}Nome da feature não pode ser vazio!${NC}"
        exit 1
    fi
    
    git checkout develop
    git pull origin develop
    git checkout -b "feature/$feature_name"
    
    echo -e "${GREEN}✅ Feature branch 'feature/$feature_name' criada!${NC}"
    echo "Você pode começar a desenvolver. Quando terminar, use:"
    echo "  ./scripts/git-flow.sh finish-feature"
}

# Função para finalizar feature
finish_feature() {
    branch=$(current_branch)
    
    if [[ ! "$branch" =~ ^feature/ ]]; then
        echo -e "${RED}❌ Você não está em uma feature branch!${NC}"
        exit 1
    fi
    
    check_clean
    
    echo -e "${YELLOW}🔀 Finalizando feature: $branch${NC}"
    
    # Merge para develop
    git checkout develop
    git pull origin develop
    git merge --no-ff "$branch" -m "Merge $branch into develop"
    
    # Push develop
    git push origin develop
    
    # Deletar feature branch
    read -p "Deletar branch $branch? (s/n): " delete_branch
    if [[ "$delete_branch" == "s" ]]; then
        git branch -d "$branch"
        git push origin --delete "$branch" 2>/dev/null
        echo -e "${GREEN}✅ Feature branch deletada!${NC}"
    fi
    
    echo -e "${GREEN}✅ Feature finalizada e merged em develop!${NC}"
    echo "Para promover para staging, use:"
    echo "  ./scripts/git-flow.sh promote-staging"
}

# Função para promover develop → staging
promote_staging() {
    check_clean
    
    echo -e "${YELLOW}📤 Promovendo develop → staging${NC}"
    
    # Atualizar develop
    git checkout develop
    git pull origin develop
    
    # Merge para staging
    git checkout staging
    git pull origin staging
    git merge --no-ff develop -m "Promote develop to staging - $(date +'%Y-%m-%d %H:%M')"
    
    # Push staging
    git push origin staging
    
    echo -e "${GREEN}✅ Código promovido para staging!${NC}"
    echo "GitHub Actions iniciará o deploy automático para staging."
    echo ""
    echo "Após testar em staging, promova para produção com:"
    echo "  ./scripts/git-flow.sh promote-production"
}

# Função para promover staging → main (produção)
promote_production() {
    echo -e "${RED}⚠️  ATENÇÃO: Você está prestes a fazer deploy para PRODUÇÃO!${NC}"
    read -p "Tem certeza que deseja continuar? (digite 'sim' para confirmar): " confirm
    
    if [[ "$confirm" != "sim" ]]; then
        echo "Deploy cancelado."
        exit 0
    fi
    
    check_clean
    
    echo -e "${YELLOW}🚀 Promovendo staging → main (produção)${NC}"
    
    # Atualizar staging
    git checkout staging
    git pull origin staging
    
    # Criar tag de release
    read -p "Versão da release (ex: 1.0.0): " version
    if [[ -z "$version" ]]; then
        echo -e "${RED}Versão não pode ser vazia!${NC}"
        exit 1
    fi
    
    # Merge para main
    git checkout main
    git pull origin main
    git merge --no-ff staging -m "Release v$version - Promote staging to production"
    
    # Criar tag
    git tag -a "v$version" -m "Release v$version"
    
    # Push main e tag
    git push origin main
    git push origin "v$version"
    
    echo -e "${GREEN}✅ Deploy para produção iniciado!${NC}"
    echo "Version: v$version"
    echo "GitHub Actions está fazendo o deploy automático."
    
    # Sync develop com main
    echo -e "${BLUE}🔄 Sincronizando develop com main...${NC}"
    git checkout develop
    git merge main -m "Sync develop with production release v$version"
    git push origin develop
    
    echo -e "${GREEN}✅ Todas as branches estão sincronizadas!${NC}"
}

# Função para hotfix de produção
hotfix() {
    echo -e "${RED}🔥 Criar hotfix para produção${NC}"
    read -p "Nome do hotfix (será criado como hotfix/nome): " hotfix_name
    
    if [[ -z "$hotfix_name" ]]; then
        echo -e "${RED}Nome do hotfix não pode ser vazio!${NC}"
        exit 1
    fi
    
    # Criar branch de hotfix a partir de main
    git checkout main
    git pull origin main
    git checkout -b "hotfix/$hotfix_name"
    
    echo -e "${GREEN}✅ Hotfix branch 'hotfix/$hotfix_name' criada!${NC}"
    echo "Faça as correções necessárias e depois use:"
    echo "  ./scripts/git-flow.sh finish-hotfix"
}

# Função para finalizar hotfix
finish_hotfix() {
    branch=$(current_branch)
    
    if [[ ! "$branch" =~ ^hotfix/ ]]; then
        echo -e "${RED}❌ Você não está em uma hotfix branch!${NC}"
        exit 1
    fi
    
    check_clean
    
    echo -e "${YELLOW}🔀 Finalizando hotfix: $branch${NC}"
    
    # Obter versão do hotfix
    read -p "Versão do hotfix (ex: 1.0.1): " version
    if [[ -z "$version" ]]; then
        echo -e "${RED}Versão não pode ser vazia!${NC}"
        exit 1
    fi
    
    # Merge para main
    git checkout main
    git pull origin main
    git merge --no-ff "$branch" -m "Hotfix v$version - $branch"
    git tag -a "v$version" -m "Hotfix v$version"
    
    # Push main
    git push origin main
    git push origin "v$version"
    
    # Merge para develop
    git checkout develop
    git pull origin develop
    git merge --no-ff main -m "Merge hotfix v$version into develop"
    git push origin develop
    
    # Merge para staging
    git checkout staging
    git pull origin staging
    git merge --no-ff main -m "Merge hotfix v$version into staging"
    git push origin staging
    
    # Deletar hotfix branch
    git branch -d "$branch"
    git push origin --delete "$branch" 2>/dev/null
    
    echo -e "${GREEN}✅ Hotfix v$version aplicado em todas as branches!${NC}"
}

# Função para mostrar status
status() {
    echo -e "${BLUE}📊 Status das branches:${NC}"
    echo ""
    
    # Branch atual
    echo -e "${CYAN}Branch atual:${NC} $(current_branch)"
    echo ""
    
    # Commits ahead/behind para cada branch
    for branch in develop staging main; do
        git checkout "$branch" &>/dev/null
        git fetch origin "$branch" &>/dev/null
        
        ahead=$(git rev-list --count origin/"$branch".."$branch")
        behind=$(git rev-list --count "$branch"..origin/"$branch")
        
        echo -e "${YELLOW}$branch:${NC}"
        echo "  ↑ $ahead commits ahead of origin"
        echo "  ↓ $behind commits behind origin"
        
        # Último commit
        last_commit=$(git log -1 --pretty=format:"%h - %s (%cr) <%an>")
        echo "  Último commit: $last_commit"
        echo ""
    done
}

# Menu de ajuda
help() {
    echo ""
    echo "Comandos disponíveis:"
    echo ""
    echo -e "${GREEN}Desenvolvimento:${NC}"
    echo "  new-feature       - Criar nova feature branch"
    echo "  finish-feature    - Finalizar feature e merge em develop"
    echo ""
    echo -e "${YELLOW}Promoção:${NC}"
    echo "  promote-staging   - Promover develop → staging"
    echo "  promote-production - Promover staging → main (produção)"
    echo ""
    echo -e "${RED}Hotfix:${NC}"
    echo "  hotfix           - Criar hotfix branch"
    echo "  finish-hotfix    - Finalizar hotfix e aplicar em todas branches"
    echo ""
    echo -e "${BLUE}Utilitários:${NC}"
    echo "  status           - Mostrar status de todas as branches"
    echo "  update           - Atualizar todas as branches"
    echo "  help             - Mostrar esta ajuda"
    echo ""
    echo "Fluxo normal:"
    echo "  develop → staging → main"
    echo ""
}

# Main
case "$1" in
    new-feature)
        new_feature
        ;;
    finish-feature)
        finish_feature
        ;;
    promote-staging)
        promote_staging
        ;;
    promote-production)
        promote_production
        ;;
    hotfix)
        hotfix
        ;;
    finish-hotfix)
        finish_hotfix
        ;;
    status)
        status
        ;;
    update)
        update_branches
        ;;
    help|"")
        help
        ;;
    *)
        echo -e "${RED}Comando inválido: $1${NC}"
        help
        exit 1
        ;;
esac
