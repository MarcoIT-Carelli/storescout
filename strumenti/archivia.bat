@echo off
rem ============================================================================
rem  StoreScout - archiviazione dei file su questo computer
rem
rem  Lancia archivia.mjs e registra tutto in archivia.log.
rem
rem  Esiste per due motivi. Il primo: l'Utilita' di pianificazione non ha un
rem  modo affidabile di impostare la cartella di lavoro, e senza quella lo
rem  script parte da C:\Windows\System32, non trova il file .env accanto a se'
rem  e si ferma. Qui `cd /d "%~dp0"` lo risolve una volta per tutte.
rem  Il secondo: di un'attivita' che gira di notte serve la traccia di cosa ha
rem  fatto, e il Prompt dei comandi si chiude senza lasciare niente.
rem ============================================================================

cd /d "%~dp0"

rem Node dal PATH; se l'attivita' pianificata non lo eredita, il percorso solito.
set "NODE=node"
where node >nul 2>&1 || set "NODE=C:\Program Files\nodejs\node.exe"

rem Il log non deve crescere all'infinito: oltre il megabyte si tiene solo
rem l'ultimo giro come .old e si riparte puliti.
if exist archivia.log (
  for %%F in (archivia.log) do if %%~zF GTR 1048576 (
    if exist archivia.old.log del archivia.old.log
    ren archivia.log archivia.old.log
  )
)

echo. >> archivia.log
echo ===== %DATE% %TIME% ===== >> archivia.log
"%NODE%" archivia.mjs >> archivia.log 2>&1
set ESITO=%ERRORLEVEL%

if %ESITO% NEQ 0 (
  echo [!] Terminato con errori, vedi archivia.log >> archivia.log
)

rem L'esito torna all'Utilita' di pianificazione, che lo mostra nella colonna
rem "Risultato ultima esecuzione": 0x0 riuscita, 0x1 qualcosa non e' andato.
exit /b %ESITO%
