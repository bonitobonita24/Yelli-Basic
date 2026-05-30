# Removes the Yelli Windows service and firewall rule. Leaves C:\Yelli\ on disk.
#Requires -RunAsAdministrator
$ServiceName = 'Yelli'
$Port = 8443

$nssmExe = (Get-Command nssm -ErrorAction SilentlyContinue).Source
if (-not $nssmExe -and (Test-Path 'C:\nssm\nssm.exe')) { $nssmExe = 'C:\nssm\nssm.exe' }
if (-not $nssmExe) { Write-Host "nssm not found on PATH or C:\nssm -- cannot remove service" -ForegroundColor Red; exit 1 }

if (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue) {
    & $nssmExe stop $ServiceName confirm 2>&1 | Out-Null
    & $nssmExe remove $ServiceName confirm | Out-Null
    Write-Host "Service removed: $ServiceName"
}

$ruleName = "Yelli LAN $Port"
if (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue) {
    Remove-NetFirewallRule -DisplayName $ruleName
    Write-Host "Firewall rule removed: $ruleName"
}

Write-Host "Done. App files at C:\Yelli\ are untouched -- delete manually if desired."
