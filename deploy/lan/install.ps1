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
    [string]$ip       = "",
    [string]$bundle   = "",
    [switch]$skipLoad = $false,
    [switch]$force    = $false,
    [switch]$down     = $false,
    [switch]$help     = $false
)

$ErrorActionPreference = "Stop"
$scriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot   = Split-Path -Parent (Split-Path -Parent $scriptDir)

# ─── Build args to forward ───────────────────────────────────────────────────

$forwardArgs = @()
if ($ip)                    { $forwardArgs += "--ip"; $forwardArgs += $ip }
if ($bundle)                { $forwardArgs += "--bundle"; $forwardArgs += $bundle }
if ($skipLoad.IsPresent)    { $forwardArgs += "--skip-load" }
if ($force.IsPresent)       { $forwardArgs += "--force" }
if ($down.IsPresent)        { $forwardArgs += "--down" }
if ($help.IsPresent)        { $forwardArgs += "--help" }

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

# Load images.
if (-not $skipLoad.IsPresent -and -not $down.IsPresent) {
    $bundlePath = if ($bundle) { $bundle } else { Join-Path $repoRoot "dist\yelli-lan-images.tar.gz" }
    if (-not (Test-Path $bundlePath)) {
        Write-Host "[ERR]   Bundle not found: $bundlePath" -ForegroundColor Red
        Write-Host "         Run deploy\lan\bundle.sh first, or pass --bundle <path>." -ForegroundColor Red
        exit 1
    }
    Write-Host "[INFO]  Loading images from $bundlePath ..." -ForegroundColor Cyan
    docker load -i $bundlePath
}

# mkcert.
$certsDir = Join-Path $repoRoot "certs"
$certFile = Join-Path $certsDir "lan.pem"
$keyFile  = Join-Path $certsDir "lan-key.pem"

$needCert = $force.IsPresent -or -not (Test-Path $certFile) -or -not (Test-Path $keyFile)
if ($needCert) {
    Write-Host "[INFO]  Installing mkcert root CA ..." -ForegroundColor Cyan
    mkcert -install
    if (-not (Test-Path $certsDir)) { New-Item -ItemType Directory -Path $certsDir | Out-Null }
    Write-Host "[INFO]  Generating cert for $lanIp, localhost, 127.0.0.1 ..." -ForegroundColor Cyan
    mkcert -cert-file $certFile -key-file $keyFile $lanIp localhost 127.0.0.1
    Write-Host "[OK]    Cert written to certs\." -ForegroundColor Green
} else {
    Write-Host "[OK]    Cert exists — skipping mkcert. (Use --force to regenerate.)" -ForegroundColor Green
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
    Write-Host ""
    Write-Host "[OK]    Access: https://$lanIp" -ForegroundColor Green
    Write-Host "[INFO]  First run: open https://$lanIp/setup to set the admin passphrase." -ForegroundColor Cyan
}
Pop-Location
