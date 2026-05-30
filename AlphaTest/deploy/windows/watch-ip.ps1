# Yelli LAN -- IP-change watchdog.
# Registered by Install-Yelli.ps1 as a Windows scheduled task that runs every
# 5 minutes (and once at boot). Quietly exits when nothing changed. When the
# server's LAN IP has changed since the cert was issued, regenerates the cert
# and restarts the Yelli service so the new cert takes effect.

$ErrorActionPreference = 'Stop'

$InstallRoot = 'C:\Yelli'
$ServiceName = 'Yelli'
$certPath    = Join-Path $InstallRoot 'certs\cert.pem'
$logFile     = Join-Path $InstallRoot 'logs\watchdog.log'

function Write-Log($msg) {
    $stamp = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
    Add-Content -Path $logFile -Value "$stamp  $msg"
}

# Resolve openssl
$opensslExe = if (Test-Path 'C:\Program Files\Git\usr\bin\openssl.exe') {
    'C:\Program Files\Git\usr\bin\openssl.exe'
} else {
    (Get-Command openssl -ErrorAction SilentlyContinue).Source
}
if (-not $opensslExe) { exit 0 }  # nothing we can do silently

# Detect current LAN IPv4s (same filter as regen-cert.ps1)
$lanIps = @(Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object {
        $_.PrefixOrigin -in 'Dhcp','Manual' -and
        $_.IPAddress -notlike '169.*' -and
        $_.IPAddress -notlike '127.*' -and
        $_.InterfaceAlias -notmatch 'WSL|Loopback|VMware|vEthernet|Hyper-V|Bluetooth'
    } | Select-Object -ExpandProperty IPAddress)
if (-not $lanIps) { exit 0 }

# Read existing cert SAN
if (-not (Test-Path $certPath)) { exit 0 }
$sanLines = & $opensslExe x509 -in $certPath -noout -ext subjectAltName 2>$null
$currentSan = ($sanLines | Where-Object { $_ -match 'IP Address' }) -join ' '

# No-op if every current IP is already covered
$missing = $false
foreach ($ip in $lanIps) {
    if ($currentSan -notmatch [regex]::Escape($ip)) { $missing = $true; break }
}
if (-not $missing) { exit 0 }

# IP changed -- regen cert and restart service
Write-Log "IP change detected (new IPs: $($lanIps -join ', ')). Regenerating cert and restarting service."
try {
    & "$InstallRoot\deploy\windows\regen-cert.ps1" -InstallRoot $InstallRoot -OpensslExe $opensslExe | Out-Null
    if (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue) {
        Restart-Service $ServiceName -Force
        Write-Log "Service $ServiceName restarted successfully."
    } else {
        Write-Log "Service $ServiceName not present; cert regenerated only."
    }
} catch {
    Write-Log "ERROR during cert/service refresh: $_"
    exit 1
}
