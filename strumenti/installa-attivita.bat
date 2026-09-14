@echo off
rem ============================================================================
rem  StoreScout - crea l'attivita' pianificata giornaliera
rem
rem  Da lanciare una volta sola, con un doppio clic. Registra l'esecuzione di
rem  archivia.bat ogni sera alle 21:00.
rem
rem  Le 21 perche' il recupero degli invii lavora fino alle 20: a quell'ora la
rem  giornata e' chiusa e non ci sono schede a meta'.
rem ============================================================================

setlocal
set "NOME=StoreScout archivio"
set "COMANDO=%~dp0archivia.bat"
set "ORA=21:00"

echo.
echo  Attivita' da creare:  %NOME%
echo  Comando:              %COMANDO%
echo  Ogni giorno alle:     %ORA%
echo.

if not exist "%COMANDO%" (
  echo  [!] Non trovo archivia.bat in questa cartella.
  echo      Questo file va lanciato dalla cartella dove stanno gli altri.
  echo.
  pause
  exit /b 1
)

if not exist "%~dp0archivia.mjs" (
  echo  [!] Non trovo archivia.mjs in questa cartella.
  echo.
  pause
  exit /b 1
)

if not exist "%~dp0.env" (
  echo  [!] Non trovo il file .env in questa cartella.
  echo      Senza, lo script non sa a quale Supabase collegarsi.
  echo      Crealo prima di continuare: vedi le istruzioni in cima ad archivia.mjs
  echo.
  pause
  exit /b 1
)

rem /f sovrascrive un'attivita' con lo stesso nome: si puo' rilanciare questo
rem file per cambiare l'orario senza doverla prima cancellare a mano.
schtasks /create /tn "%NOME%" /tr "\"%COMANDO%\"" /sc daily /st %ORA% /f

if %ERRORLEVEL% NEQ 0 (
  echo.
  echo  [!] Creazione non riuscita.
  echo      Se dice che servono privilegi piu' alti, chiudi e riapri questo file
  echo      con il tasto destro - "Esegui come amministratore".
  echo.
  pause
  exit /b 1
)

echo.
echo  Fatto. L'attivita' partira' ogni sera alle %ORA%.
echo.
echo  Per provarla subito, senza aspettare:
echo      schtasks /run /tn "%NOME%"
echo.
echo  Per vedere com'e' andata l'ultima volta:
echo      archivia.log  in questa cartella
echo.
pause
