# NSSM service entry point. Tries cert regen, then runs node.
# Stdout/stderr captured by NSSM into C:\Yelli\logs\service.log.

$InstallRoot = 'C:\Yelli'
$ErrorActionPreference = 'Continue'

try {
    $opensslExe = if (Test-Path 'C:\Program Files\Git\usr\bin\openssl.exe') {
        'C:\Program Files\Git\usr\bin\openssl.exe'
    } else {
        (Get-Command openssl -ErrorAction SilentlyContinue).Source
    }
    if ($opensslExe) {
        & "$InstallRoot\deploy\windows\regen-cert.ps1" -InstallRoot $InstallRoot -OpensslExe $opensslExe
    } else {
        Write-Warning "openssl not found; using existing cert"
    }
} catch {
    Write-Warning "Cert regen failed: $_  (continuing with existing cert)"
}

Set-Location $InstallRoot
$nodeExe = (Get-Command node).Source
& $nodeExe server.js
