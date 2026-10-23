@echo off
rem CKAgram laptop labs. Usage: ckalab help
if not exist "%~dp0labs\node_modules" call npm install --prefix "%~dp0labs" --silent
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON "%~dp0labs\ckalab.mjs" %*
