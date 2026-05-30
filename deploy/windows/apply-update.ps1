# Yelli LAN -- pulls latest from GitHub, syncs files, restarts service.
# Triggered (detached) by the admin "Update Now" button on /_pwbt/.
# Logs to C:\Yelli\logs\update.log.

$ErrorActionPreference = 'Continue'

$InstallRoot = 'C:\Yelli'
$ServiceName = 'Yelli'
$RepoSource  = Join-Path $InstallRoot '.update-source'
$AppSource   = $RepoSource
$LogDir      = Join-Path $InstallRoot 'logs'
$LogFile     = Join-Path $LogDir       'update.log'

function Log($msg) {
    if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Force -Path $LogDir | Out-Null }
    $stamp = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
    Add-Content -Path $LogFile -Value "$stamp  $msg"
}

# Give the server time to send its 202 response before we tear it down
Start-Sleep -Seconds 2

try {
    Log "=== Update started ==="

    if (-not (Test-Path "$RepoSource\.git")) {
        Log "ERROR: $RepoSource is not a git clone. Re-run Install-Yelli.cmd to set it up."
        exit 1
    }

    $gitExe = (Get-Command git -ErrorAction SilentlyContinue).Source
    if (-not $gitExe) {
        foreach ($p in @('C:\Program Files\Git\bin\git.exe','C:\Program Files\Git\cmd\git.exe')) {
            if (Test-Path $p) { $gitExe = $p; break }
        }
    }
    if (-not $gitExe) { Log "ERROR: git not found"; exit 1 }

    # Track package.json hash to decide if we need npm install
    $pkgBefore = if (Test-Path "$InstallRoot\package.json") {
        (Get-FileHash "$InstallRoot\package.json" -Algorithm SHA1).Hash
    } else { '' }

    Log "Running git pull..."
    $gitOut = & $gitExe -C $RepoSource pull --ff-only 2>&1 | Out-String
    Log ("git pull: " + $gitOut.Trim())
    if ($LASTEXITCODE -ne 0) {
        Log "ERROR: git pull failed (exit $LASTEXITCODE); aborting"
        exit 1
    }

    if (-not (Test-Path "$AppSource\server.js")) {
        Log "ERROR: $AppSource\server.js not found after pull"
        exit 1
    }

    Log "Stopping $ServiceName service..."
    Stop-Service $ServiceName -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1

    Log "Syncing files (robocopy)..."
    & robocopy $AppSource $InstallRoot /E /R:1 /W:1 `
        /XD data logs certs node_modules .git .update-source .claude .specstory .vscode docs `
        /XF Install-Yelli.cmd Install-Yelli.ps1 AlphaTest.zip PRODUCT.md Product_md_Planning_Assistant_v31.md compose.yaml fly.toml `
        /NFL /NDL /NJH /NJS /NC /NS | Out-Null
    if ($LASTEXITCODE -ge 8) {
        Log "ERROR: robocopy failed (exit $LASTEXITCODE)"
    } else {
        Log "Files synced (robocopy exit $LASTEXITCODE)"
    }

    $pkgAfter = if (Test-Path "$InstallRoot\package.json") {
        (Get-FileHash "$InstallRoot\package.json" -Algorithm SHA1).Hash
    } else { '' }
    if ($pkgBefore -ne $pkgAfter) {
        Log "package.json changed -- running npm install --omit=dev"
        $npmCmd = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
        if (-not $npmCmd) { $npmCmd = "$env:ProgramFiles\nodejs\npm.cmd" }
        Push-Location $InstallRoot
        try {
            & $npmCmd install --omit=dev 2>&1 | ForEach-Object { Log ("  npm: " + $_) }
        } finally { Pop-Location }
    } else {
        Log "package.json unchanged; skipping npm install"
    }

    Log "Starting $ServiceName service..."
    Start-Service $ServiceName
    Log "=== Update complete ==="
    exit 0

} catch {
    Log "FATAL: $_"
    try { Start-Service $ServiceName } catch {}
    exit 1
}
