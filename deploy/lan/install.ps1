# SURFACED FORK — Windows-native path; owner confirms target OS.
# Core logic lives in install.sh (bash). This script is a thin wrapper.
#
# Preferred path: Delegates to install.sh via Git-Bash if available.
# Fallback path:  Native PowerShell (minimal — IP detect, mkcert, env render, docker compose).
#
# Usage (from repo root in PowerShell):
#   .\deploy\lan\install.ps1 [ARGS]
#   .\deploy\lan\install.ps1 --ip 192.168.1.50
#   .\deploy\lan\install.ps1 --force
#   .\deploy\lan\install.ps1 --down
#
# All flags are passed through to install.sh (or the native fallback).

#Requires -Version 5.1
[CmdletBinding()]
param(
    [string]$ip           = "",
    [string]$bundle       = "",
    [string]$pubkey       = "",
    [switch]$skipVerify   = $false,
    [switch]$skipLoad     = $false,
    [switch]$force        = $false,
    [switch]$refreshCert  = $false,
    [switch]$down         = $false,
    [switch]$help         = $false
)

$ErrorActionPreference = "Stop"
$scriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot   = Split-Path -Parent (Split-Path -Parent $scriptDir)

# ─── Build args to forward ───────────────────────────────────────────────────

$forwardArgs = @()
if ($ip)                     { $forwardArgs += "--ip"; $forwardArgs += $ip }
if ($bundle)                 { $forwardArgs += "--bundle"; $forwardArgs += $bundle }
if ($pubkey)                 { $forwardArgs += "--pubkey"; $forwardArgs += $pubkey }
if ($skipVerify.IsPresent)   { $forwardArgs += "--skip-verify" }
if ($skipLoad.IsPresent)     { $forwardArgs += "--skip-load" }
if ($force.IsPresent)        { $forwardArgs += "--force" }
if ($refreshCert.IsPresent)  { $forwardArgs += "--refresh-cert" }
if ($down.IsPresent)         { $forwardArgs += "--down" }
if ($help.IsPresent)         { $forwardArgs += "--help" }

$installSh = Join-Path $scriptDir "install.sh"

# ─── Path 1: Git-Bash (preferred on Windows) ─────────────────────────────────

$gitBashPaths = @(
    "$env:ProgramFiles\Git\bin\bash.exe",
    "$env:ProgramFiles\Git\usr\bin\bash.exe",
    "${env:ProgramFiles(x86)}\Git\bin\bash.exe"
)

$gitBash = $null
foreach ($p in $gitBashPaths) {
    if (Test-Path $p) { $gitBash = $p; break }
}

if ($gitBash) {
    Write-Host "[INFO]  Found Git-Bash at: $gitBash" -ForegroundColor Cyan
    Write-Host "[INFO]  Delegating to install.sh ..." -ForegroundColor Cyan

    # Convert Windows path to Unix path for bash.
    $installShUnix = $installSh -replace "\\", "/" -replace "^([A-Za-z]):", { "/$($_.Groups[1].Value.ToLower())" }
    Push-Location $repoRoot
    & $gitBash $installShUnix @forwardArgs
    $exitCode = $LASTEXITCODE
    Pop-Location
    exit $exitCode
}

# ─── Path 2: Native PowerShell fallback ──────────────────────────────────────

Write-Host "[INFO]  Git-Bash not found. Running Windows-native install path." -ForegroundColor Yellow
Write-Host "[WARN]  For best results, install Git for Windows: https://git-scm.com/download/win" -ForegroundColor Yellow
Write-Host ""

# Check Docker.
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "[ERR]   Docker not found. Install Docker Desktop:" -ForegroundColor Red
    Write-Host "         https://www.docker.com/products/docker-desktop/" -ForegroundColor Red
    exit 1
}

# Check docker compose v2.
try { docker compose version | Out-Null }
catch {
    Write-Host "[ERR]   'docker compose' (v2) not found. Install Docker Desktop." -ForegroundColor Red
    exit 1
}

# Check mkcert.
if (-not (Get-Command mkcert -ErrorAction SilentlyContinue)) {
    Write-Host "[ERR]   mkcert not found. Install with:" -ForegroundColor Red
    Write-Host "         choco install mkcert    # Chocolatey" -ForegroundColor Yellow
    Write-Host "         scoop install mkcert    # Scoop" -ForegroundColor Yellow
    Write-Host "         Or download: https://github.com/FiloSottile/mkcert/releases" -ForegroundColor Yellow
    exit 1
}

# Detect LAN IP (Windows).
if ($ip) {
    $lanIp = $ip
} else {
    $lanIp = (Get-NetIPAddress -AddressFamily IPv4 `
        | Where-Object { $_.InterfaceAlias -notmatch "Loopback" -and $_.PrefixOrigin -eq "Dhcp" } `
        | Select-Object -First 1 -ExpandProperty IPAddress)
    if (-not $lanIp) {
        # Fallback: first non-loopback IPv4.
        $lanIp = (Get-NetIPAddress -AddressFamily IPv4 `
            | Where-Object { $_.IPAddress -ne "127.0.0.1" } `
            | Select-Object -First 1 -ExpandProperty IPAddress)
    }
}
if (-not $lanIp) {
    Write-Host "[ERR]   Could not detect LAN IP. Pass --ip <addr>." -ForegroundColor Red
    exit 1
}
Write-Host "[INFO]  LAN IP: $lanIp" -ForegroundColor Cyan

# Resolve bundle path (auto-detect newest yelli-lan-*.tar.gz).
$bundlePath = if ($bundle) { $bundle } else {
    $found = Get-ChildItem (Join-Path $repoRoot "dist") -Filter "yelli-lan-*.tar.gz" -ErrorAction SilentlyContinue `
        | Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
    if ($found) { $found } else { Join-Path $repoRoot "dist\yelli-lan-images.tar.gz" }
}

# Verify bundle signature and checksum (native PowerShell path — delegate to bash if possible).
if (-not $skipLoad.IsPresent -and -not $down.IsPresent) {
    if ($skipVerify.IsPresent) {
        Write-Host "[WARN]  -skipVerify set — signature check SKIPPED. NOT for production use." -ForegroundColor Yellow
    } else {
        if (-not (Test-Path $bundlePath)) {
            Write-Host "[ERR]   Bundle not found: $bundlePath" -ForegroundColor Red
            Write-Host "         Run deploy\lan\bundle.sh first, or pass -bundle <path>." -ForegroundColor Red
            exit 1
        }
        # SHA-256 checksum.
        $sha256File = "$bundlePath.sha256"
        if (-not (Test-Path $sha256File)) {
            Write-Host "[ERR]   Checksum file not found: $sha256File" -ForegroundColor Red
            Write-Host "         Pass -skipVerify to bypass (dev only)." -ForegroundColor Red
            exit 1
        }
        $expectedHash = (Get-Content $sha256File -Raw).Split(" ")[0].Trim()
        $actualHash   = (Get-FileHash $bundlePath -Algorithm SHA256).Hash.ToLower()
        if ($expectedHash.ToLower() -ne $actualHash) {
            Write-Host "[ERR]   SHA-256 MISMATCH — bundle may be corrupted or tampered." -ForegroundColor Red
            Write-Host "         Expected: $expectedHash" -ForegroundColor Red
            Write-Host "         Got:      $actualHash"  -ForegroundColor Red
            exit 1
        }
        Write-Host "[OK]    SHA-256 checksum: PASS" -ForegroundColor Green

        # Signature: the native PS path cannot run minisign/gpg reliably without
        # external tooling. Emit a clear message and require Git-Bash for full verify,
        # or allow the operator to pass -skipVerify for dev scenarios.
        $sigFile = "$bundlePath.sig"
        if (Test-Path $sigFile) {
            Write-Host "[WARN]  Signature file detected: $(Split-Path -Leaf $sigFile)" -ForegroundColor Yellow
            Write-Host "[WARN]  Native PowerShell cannot run minisign/gpg automatically." -ForegroundColor Yellow
            Write-Host "[WARN]  For full signature verification, use Git-Bash:" -ForegroundColor Yellow
            Write-Host "         bash deploy/lan/install.sh --bundle $bundlePath" -ForegroundColor Yellow
            Write-Host "[WARN]  Proceeding with checksum-only verification (no signature check)." -ForegroundColor Yellow
            Write-Host "[WARN]  Install Git-Bash for full trust verification." -ForegroundColor Yellow
        } else {
            Write-Host "[WARN]  No signature file found — bundle is unsigned or signature missing." -ForegroundColor Yellow
        }
    }
}

# Load images.
if (-not $skipLoad.IsPresent -and -not $down.IsPresent) {
    if (-not (Test-Path $bundlePath)) {
        Write-Host "[ERR]   Bundle not found: $bundlePath" -ForegroundColor Red
        Write-Host "         Run deploy\lan\bundle.sh first, or pass -bundle <path>." -ForegroundColor Red
        exit 1
    }
    Write-Host "[INFO]  Loading images from $bundlePath ..." -ForegroundColor Cyan
    docker load -i $bundlePath
}

# mkcert + IP-change detection.
$certsDir   = Join-Path $repoRoot "certs"
$certFile   = Join-Path $certsDir "lan.pem"
$keyFile    = Join-Path $certsDir "lan-key.pem"
$certState  = Join-Path $certsDir ".cert-state"

# Read previous cert IP from state file.
$prevCertIp = ""
if (Test-Path $certState) {
    $prevCertIp = (Get-Content $certState | Where-Object { $_ -match '^CERT_IP=' }) `
        -replace '^CERT_IP=', ''
}

# Warn prominently if the IP has changed.
if ($prevCertIp -ne "" -and $prevCertIp -ne $lanIp) {
    Write-Host "" -ForegroundColor Yellow
    Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Yellow
    Write-Host "║  ⚠  LAN IP CHANGED — TLS CERTIFICATE WILL BE REGENERATED   ║" -ForegroundColor Yellow
    Write-Host "║                                                              ║" -ForegroundColor Yellow
    Write-Host ("║  Previous IP:  {0,-44} ║" -f $prevCertIp) -ForegroundColor Yellow
    Write-Host ("║  New IP:       {0,-44} ║" -f $lanIp) -ForegroundColor Yellow
    Write-Host "║                                                              ║" -ForegroundColor Yellow
    Write-Host "║  The old cert is no longer valid.  A new mkcert certificate  ║" -ForegroundColor Yellow
    Write-Host "║  will be issued for the new IP.                              ║" -ForegroundColor Yellow
    Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Yellow
    Write-Host "" -ForegroundColor Yellow
}

$ipChanged = ($prevCertIp -ne "" -and $prevCertIp -ne $lanIp)
$needCert  = $force.IsPresent -or $refreshCert.IsPresent -or $ipChanged `
             -or -not (Test-Path $certFile) -or -not (Test-Path $keyFile)

if ($needCert) {
    Write-Host "[INFO]  Installing mkcert root CA ..." -ForegroundColor Cyan
    mkcert -install
    if (-not (Test-Path $certsDir)) { New-Item -ItemType Directory -Path $certsDir | Out-Null }
    Write-Host "[INFO]  Generating cert for $lanIp, localhost, 127.0.0.1 ..." -ForegroundColor Cyan
    mkcert -cert-file $certFile -key-file $keyFile $lanIp localhost 127.0.0.1
    # Persist cert state.
    $ts = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ" -AsUTC 2>$null) ?? (Get-Date -Format "yyyy-MM-ddTHH:mm:ss")
    Set-Content $certState "CERT_IP=$lanIp`nCERT_ISSUED_AT=$ts"
    Write-Host "[OK]    Cert written to certs\.  State recorded in certs\.cert-state." -ForegroundColor Green
} else {
    Write-Host "[OK]    Cert exists — skipping mkcert. (Use -force or -refreshCert to regenerate.)" -ForegroundColor Green
}

# Generate .env.lan.
$envFile    = Join-Path $repoRoot ".env.lan"
$envExample = Join-Path $repoRoot ".env.lan.example"

function New-Secret([int]$len = 48) {
    $bytes = New-Object byte[] ($len * 2)
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $b64 = [Convert]::ToBase64String($bytes) -replace '[/+=]', ''
    return $b64.Substring(0, [Math]::Min($len, $b64.Length))
}

if ((Test-Path $envFile) -and -not $force.IsPresent) {
    $ts     = Get-Date -Format "yyyyMMddHHmmss"
    $backup = "$envFile.bak.$ts"
    Write-Host "[WARN]  .env.lan exists. Backing up to $(Split-Path -Leaf $backup)." -ForegroundColor Yellow
    Copy-Item $envFile $backup
    # Patch IP in existing file.
    (Get-Content $envFile) `
        -replace '^LAN_IP=.*', "LAN_IP=$lanIp" `
        -replace '^NEXTAUTH_URL=.*', "NEXTAUTH_URL=https://$lanIp" `
        -replace '^NEXT_PUBLIC_SIGNALING_URL=.*', "NEXT_PUBLIC_SIGNALING_URL=wss://$lanIp/ws" `
        | Set-Content $envFile
    Write-Host "[OK]    Updated LAN_IP in existing .env.lan (secrets preserved)." -ForegroundColor Green
} else {
    Write-Host "[INFO]  Generating .env.lan ..." -ForegroundColor Cyan
    $content = Get-Content $envExample -Raw
    $content = $content -replace '192\.168\.1\.100', $lanIp
    $content = $content -replace '^(DB_PASSWORD)=__generated_at_install__',    "`$1=$(New-Secret 32)"
    $content = $content -replace '^(REDIS_PASSWORD)=__generated_at_install__', "`$1=$(New-Secret 32)"
    $content = $content -replace '^(STORAGE_SECRET_KEY)=__generated_at_install__', "`$1=$(New-Secret 32)"
    $content = $content -replace '^(S3_SECRET_KEY)=__generated_at_install__',  "`$1=$(New-Secret 32)"
    $content = $content -replace '^(AUTH_SECRET)=__generated_at_install__',    "`$1=$(New-Secret 48)"
    Set-Content $envFile $content
    Write-Host "[OK]    .env.lan generated." -ForegroundColor Green
}

# Resolve COMPOSE_PROJECT_NAME.
$composeProjectName = (Get-Content $envFile | Where-Object { $_ -match '^COMPOSE_PROJECT_NAME=' }) `
    -replace '^COMPOSE_PROJECT_NAME=', ''

# Render Caddyfile.
$caddyTpl  = Join-Path $repoRoot "deploy\compose\lan\Caddyfile.template"
$caddyFile = Join-Path $repoRoot "deploy\compose\lan\Caddyfile"
Write-Host "[INFO]  Rendering Caddyfile ..." -ForegroundColor Cyan
(Get-Content $caddyTpl -Raw) `
    -replace '\$\{LAN_IP\}', $lanIp `
    -replace '\$\{COMPOSE_PROJECT_NAME\}', $composeProjectName `
    | Set-Content $caddyFile
Write-Host "[OK]    Caddyfile rendered." -ForegroundColor Green

# -refreshCert fast path: reload Caddy and exit without touching the full stack.
if ($refreshCert.IsPresent) {
    $composeFiles2 = @(
        "deploy\compose\lan\docker-compose.db.yml",
        "deploy\compose\lan\docker-compose.cache.yml",
        "deploy\compose\lan\docker-compose.storage.yml",
        "deploy\compose\lan\docker-compose.worker.yml",
        "deploy\compose\lan\docker-compose.signaling.yml",
        "deploy\compose\lan\docker-compose.app.yml",
        "deploy\compose\lan\docker-compose.proxy.yml"
    )
    $fArgs2 = $composeFiles2 | ForEach-Object { @("-f", (Join-Path $repoRoot $_)) }
    Push-Location $repoRoot
    Write-Host "[INFO]  Reloading Caddy to pick up the new certificate ..." -ForegroundColor Cyan
    $reloaded = $false
    try {
        docker compose --env-file .env.lan @fArgs2 exec -T caddy caddy reload --config /etc/caddy/Caddyfile 2>$null
        if ($LASTEXITCODE -eq 0) { $reloaded = $true }
    } catch { }
    if (-not $reloaded) {
        Write-Host "[WARN]  caddy reload unavailable; restarting caddy container ..." -ForegroundColor Yellow
        docker compose --env-file .env.lan @fArgs2 restart caddy
    }
    Pop-Location
    Write-Host "[OK]    IP-change cert refresh complete.  New IP: $lanIp" -ForegroundColor Green
    Write-Host "[OK]    Access: https://$lanIp" -ForegroundColor Green
    exit 0
}

# Bring stack up or down.
$composeFiles = @(
    "deploy\compose\lan\docker-compose.db.yml",
    "deploy\compose\lan\docker-compose.cache.yml",
    "deploy\compose\lan\docker-compose.storage.yml",
    "deploy\compose\lan\docker-compose.worker.yml",
    "deploy\compose\lan\docker-compose.signaling.yml",
    "deploy\compose\lan\docker-compose.app.yml",
    "deploy\compose\lan\docker-compose.proxy.yml"
)
$fArgs = $composeFiles | ForEach-Object { @("-f", (Join-Path $repoRoot $_)) }

Push-Location $repoRoot
if ($down.IsPresent) {
    Write-Host "[INFO]  Stopping stack ..." -ForegroundColor Cyan
    docker compose --env-file .env.lan @fArgs down --remove-orphans
    Write-Host "[OK]    Stack stopped. Volumes preserved." -ForegroundColor Green
} else {
    Write-Host "[INFO]  Starting Yelli LAN stack ..." -ForegroundColor Cyan
    docker compose --env-file .env.lan @fArgs up -d --remove-orphans
    Write-Host "[OK]    Stack started." -ForegroundColor Green

    # If the LAN IP changed while a stack was ALREADY running, `up -d` re-mounts the
    # new cert files but does NOT recreate the (unchanged-spec, bind-mounted) caddy
    # container — so it keeps serving the OLD in-memory cert. Force a reload to
    # activate the regenerated cert. Harmless no-op when caddy was just created.
    if ($ipChanged) {
        Write-Host "[INFO]  LAN IP changed — reloading Caddy to activate the new certificate ..." -ForegroundColor Cyan
        $reloaded = $false
        try {
            docker compose --env-file .env.lan @fArgs exec -T caddy caddy reload --config /etc/caddy/Caddyfile 2>$null
            if ($LASTEXITCODE -eq 0) { $reloaded = $true }
        } catch { }
        if (-not $reloaded) {
            Write-Host "[WARN]  caddy reload unavailable; restarting caddy container ..." -ForegroundColor Yellow
            docker compose --env-file .env.lan @fArgs restart caddy
        }
        Write-Host "[OK]    Caddy reloaded — new certificate is active." -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "[OK]    Access: https://$lanIp" -ForegroundColor Green
    Write-Host "[INFO]  First run: open https://$lanIp/setup to set the admin passphrase." -ForegroundColor Cyan
}
Pop-Location
