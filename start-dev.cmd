@echo off
setlocal
pushd "%~dp0" || exit /b 1
set "NODE_ENV=development"
call corepack pnpm exec next dev %*
set "SP_DEV_EXIT_CODE=%ERRORLEVEL%"
popd
exit /b %SP_DEV_EXIT_CODE%
