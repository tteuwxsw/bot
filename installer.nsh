!macro customUnInstall
  ${ifNot} ${isUpdated}
    nsExec::ExecToLog 'schtasks.exe /Delete /TN "Painel de Preenchimento - Cadastro diario" /F'
  ${endIf}
!macroend
