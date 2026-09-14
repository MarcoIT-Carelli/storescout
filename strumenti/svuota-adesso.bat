@echo off
rem ============================================================================
rem  StoreScout - svuotamento forzato
rem
rem  Come archivia.bat, ma porta via anche i file recenti invece di lasciarne
rem  una settimana sul server.
rem
rem  Da usare quando lo spazio su Supabase e' finito e i caricamenti
rem  cominciano a fallire: in quel momento liberare conta piu' che poter
rem  rispedire una scheda di ieri, che comunque e' gia' arrivata.
rem
rem  Dopo averlo lanciato, le schede degli ultimi giorni non saranno piu'
rem  rispedibili dal pannello: il PDF non e' piu' sul server.
rem ============================================================================

cd /d "%~dp0"

set "NODE=node"
where node >nul 2>&1 || set "NODE=C:\Program Files\nodejs\node.exe"

echo.
echo  Questo porta via TUTTO da Supabase, anche i file di oggi.
echo  Le schede recenti non saranno piu' rispedibili dal pannello.
echo.
set /p RISPOSTA="  Procedere? (s/n) "
if /i not "%RISPOSTA%"=="s" (
  echo  Annullato.
  pause
  exit /b 0
)

echo. >> archivia.log
echo ===== %DATE% %TIME% - SVUOTAMENTO FORZATO ===== >> archivia.log
"%NODE%" archivia.mjs --tutto >> archivia.log 2>&1
set ESITO=%ERRORLEVEL%

echo.
if %ESITO% EQU 0 (
  echo  Fatto. Il dettaglio e' in archivia.log
) else (
  echo  [!] Qualcosa non e' andato, vedi archivia.log
)
echo.
pause
exit /b %ESITO%
