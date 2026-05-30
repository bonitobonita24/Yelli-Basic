# Yelli LAN -- regenerates the self-signed TLS cert if the current LAN IP is
# not in its SAN. Called by Install-Yelli.ps1 and by start-yelli.ps1 on every
# service start, so the cert stays valid when the host moves networks.

param(
    [string]$InstallRoot = 'C:\Yelli',
    [string]$OpensslExe  = 'C:\Program Files\Git\usr\bin\openssl.exe'
)

$ErrorActionPreference = 'Stop'
$certDir  = Join-Path $InstallRoot 'certs'
$certPath = Join-Path $certDir 'cert.pem'
$keyPath  = Join-Path $certDir 'key.pem'

# Detect real LAN IPv4s (skip APIPA, loopback, virtual adapters)
$lanIps = @(Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object {
        $_.PrefixOrigin -in 'Dhcp','Manual' -and
        $_.IPAddress -notlike '169.*' -and
        $_.IPAddress -notlike '127.*' -and
        $_.InterfaceAlias -notmatch 'WSL|Loopback|VMware|vEthernet|Hyper-V|Bluetooth'
    } | Select-Object -ExpandProperty IPAddress)

if (-not $lanIps) {
    Write-Warning "No LAN IPv4 detected; keeping existing cert (if any)."
    return
}

# Skim existing cert SAN
$currentSan = ''
if (Test-Path $certPath) {
    $sanLines = & $OpensslExe x509 -in $certPath -noout -ext subjectAltName 2>$null
    $currentSan = ($sanLines | Where-Object { $_ -match 'IP Address' }) -join ' '
}

$needRegen = $false
foreach ($ip in $lanIps) {
    if ($currentSan -notmatch [regex]::Escape($ip)) { $needRegen = $true; break }
}

if (-not $needRegen) {
    Write-Host "Cert SAN already covers $($lanIps -join ', ') -- no regen needed."
    return
}

New-Item -ItemType Directory -Force -Path $certDir | Out-Null
$sanEntries = @('DNS:localhost','IP:127.0.0.1') + ($lanIps | ForEach-Object { "IP:$_" })
$san = $sanEntries -join ','

Write-Host "Regenerating cert with SAN: $san"
& $OpensslExe req -x509 -newkey rsa:2048 -nodes `
    -keyout $keyPath -out $certPath `
    -days 365 `
    -subj "/CN=yelli-lan" `
    -addext "subjectAltName=$san" 2>$null
if ($LASTEXITCODE -ne 0) { throw "openssl cert generation failed" }

icacls $keyPath /inheritance:r /grant:r "SYSTEM:F" "Administrators:F" 2>$null | Out-Null
Write-Host "Cert regenerated."
