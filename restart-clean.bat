@echo off
echo ===========================================
echo REINICIANDO SISTEMA COM LIMPEZA DE CACHE
echo ===========================================
echo.

echo Parando processos Node...
taskkill /F /IM node.exe 2>nul

echo Limpando cache do frontend...
cd frontend
rmdir /s /q node_modules\.vite 2>nul
rmdir /s /q dist 2>nul

echo.
echo Iniciando backend...
cd ../backend
start cmd /k "npm run dev"

echo Aguardando backend...
timeout /t 3 /nobreak > nul

echo Iniciando frontend...
cd ../frontend
start cmd /k "npm run dev"

echo.
echo ===========================================
echo SISTEMA REINICIADO COM SUCESSO!
echo.
echo IMPORTANTE: Limpe o cache do navegador!
echo Pressione Ctrl+Shift+R ou Ctrl+F5
echo.
echo MUDANCAS APLICADAS:
echo - Nomes: "Rafael Franca (Teste Corp)"
echo - Tags: [Cliente], [Suporte], [Admin]
echo - Sistema 100%% em portugues
echo - Historico funcionando
echo ===========================================
echo.
echo Acesse: http://localhost:5173
echo.
pause
