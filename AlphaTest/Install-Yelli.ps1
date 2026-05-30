# Yelli LAN  -  one-click Windows installer.
#
# Run via Install-Yelli.cmd (double-click). That cmd self-elevates and calls
# this script. The script auto-installs all prerequisites via winget, copies
# the bundle to C:\Yelli\, runs npm install, generates a self-signed cert for
# this PC's current LAN IP, installs and starts the Yelli Windows service via
# NSSM, opens the firewall, and prints the URLs to hit from other devices.
#
# Idempotent: re-run any time (after updates, after IP changes, etc.).

$ErrorActionPreference = 'Stop'

$ServiceName = 'Yelli'
$InstallRoot = 'C:\Yelli'
$Port        = 8443
$AppName     = 'Yelli'

# Self-elevate if launched without admin (covers the case where someone runs
# the .ps1 directly from a non-elevated PowerShell session).
$me = New-Object System.Security.Principal.WindowsPrincipal(
    [System.Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $me.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host 'Re-launching with administrator privileges...'
    Start-Process powershell -Verb RunAs -ArgumentList @(
        '-NoProfile','-ExecutionPolicy','Bypass','-File',"`"$PSCommandPath`"")
    exit
}

try {
    Write-Host ''
    Write-Host '======================================================='
    Write-Host '  Yelli LAN  -  one-click Windows installer'
    Write-Host '======================================================='

    # --- 1. winget availability -------------------------------------------------
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        Write-Host ''
        Write-Host 'winget not found.' -ForegroundColor Red
        Write-Host 'Install "App Installer" from the Microsoft Store, then re-run this installer.'
        Read-Host 'Press Enter to exit'
        exit 1
    }

    # --- 2. Prereqs: Node.js LTS, Git for Windows (openssl), NSSM ---------------
    function Test-Prereq($detectCmd, $detectPath) {
        if (Get-Command $detectCmd -ErrorAction SilentlyContinue) { return $true }
        if ($detectPath -and (Test-Path $detectPath))             { return $true }
        return $false
    }

    function Install-Winget($wingetId, $displayName) {
        Write-Host "[..]   Installing $displayName via winget..."
        winget install --id $wingetId --exact --silent `
            --accept-source-agreements --accept-package-agreements
        if ($LASTEXITCODE -ne 0) {
            throw "winget install $wingetId failed (exit $LASTEXITCODE)"
        }
        Write-Host "[ok]   $displayName installed"
    }

    if (Test-Prereq 'node' "$env:ProgramFiles\nodejs\node.exe") {
        Write-Host '[ok]   Node.js already installed'
    } else {
        Install-Winget 'OpenJS.NodeJS.LTS' 'Node.js LTS'
    }

    if (Test-Prereq 'openssl' 'C:\Program Files\Git\usr\bin\openssl.exe') {
        Write-Host '[ok]   Git for Windows (openssl) already installed'
    } else {
        Install-Winget 'Git.Git' 'Git for Windows (provides openssl)'
    }

    $nssmPresent = (Get-Command nssm -ErrorAction SilentlyContinue) -or
                   (Test-Path 'C:\nssm\nssm.exe') -or
                   (Test-Path "$env:ProgramFiles\nssm\nssm.exe")
    if ($nssmPresent) {
        Write-Host '[ok]   NSSM already installed'
    } else {
        try {
            Install-Winget 'NSSM.NSSM' 'NSSM'
        } catch {
            # Fallback: direct download from nssm.cc if winget package unavailable
            Write-Host '[..]   winget NSSM unavailable, downloading from nssm.cc...'
            $tmpZip = "$env:TEMP\nssm.zip"
            $tmpDir = "$env:TEMP\nssm-extract"
            Invoke-WebRequest -UseBasicParsing -Uri 'https://nssm.cc/release/nssm-2.24.zip' -OutFile $tmpZip
            Remove-Item -Recurse -Force $tmpDir -ErrorAction SilentlyContinue
            Expand-Archive -Path $tmpZip -DestinationPath $tmpDir
            $exe = Get-ChildItem -Path $tmpDir -Recurse -Filter 'nssm.exe' |
                Where-Object { $_.FullName -match 'win64' } | Select-Object -First 1
            if (-not $exe) { throw 'NSSM extraction failed (win64 binary not found)' }
            New-Item -ItemType Directory -Force -Path 'C:\nssm' | Out-Null
            Copy-Item $exe.FullName 'C:\nssm\nssm.exe' -Force
            Remove-Item -Recurse -Force $tmpDir, $tmpZip -ErrorAction SilentlyContinue
            Write-Host '[ok]   NSSM installed to C:\nssm\nssm.exe'
        }
    }

    # --- 3. Refresh PATH so freshly installed binaries are visible --------------
    $env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' +
                [System.Environment]::GetEnvironmentVariable('Path','User')

    function Find-Cmd($name, $fallbacks) {
        $c = Get-Command $name -ErrorAction SilentlyContinue
        if ($c) { return $c.Source }
        foreach ($p in $fallbacks) { if (Test-Path $p) { return $p } }
        return $null
    }

    $nodeExe    = Find-Cmd 'node'    @("$env:ProgramFiles\nodejs\node.exe")
    $npmCmd     = Find-Cmd 'npm.cmd' @("$env:ProgramFiles\nodejs\npm.cmd")
    $nssmExe    = Find-Cmd 'nssm'    @('C:\nssm\nssm.exe', "$env:ProgramFiles\nssm\nssm.exe", "${env:ProgramFiles(x86)}\nssm\nssm.exe")
    $opensslExe = Find-Cmd 'openssl' @('C:\Program Files\Git\usr\bin\openssl.exe')

    if (-not ($nodeExe -and $npmCmd -and $nssmExe -and $opensslExe)) {
        Write-Host ''
        Write-Host 'After install, still missing:' -ForegroundColor Red
        if (-not $nodeExe)    { Write-Host '  - node'    }
        if (-not $npmCmd)     { Write-Host '  - npm'     }
        if (-not $nssmExe)    { Write-Host '  - nssm'    }
        if (-not $opensslExe) { Write-Host '  - openssl' }
        Write-Host 'Close this window and run Install-Yelli.cmd again - PATH should refresh.'
        Read-Host 'Press Enter to exit'
        exit 1
    }

    # --- 4. Copy bundle contents -> C:\Yelli\ -----------------------------------
    $src = $PSScriptRoot
    Write-Host ''
    Write-Host "Copying from $src  ->  $InstallRoot"
    New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null
    & robocopy $src $InstallRoot /E /R:1 /W:1 `
        /XD certs logs .git .specstory `
        /XF Install-Yelli.cmd Install-Yelli.ps1 fly.toml `
        /NFL /NDL /NJH /NJS /NC /NS | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy failed (exit $LASTEXITCODE)" }
    $global:LASTEXITCODE = 0
    Write-Host '[ok]   Bundle copied'

    # --- 5. npm install (skip if bundle already includes node_modules) ----------
    Push-Location $InstallRoot
    try {
        if (Test-Path "$InstallRoot\node_modules\ws") {
            Write-Host '[ok]   node_modules bundled with installer - skipping npm install'
        } else {
            Write-Host '[..]   npm install --omit=dev'
            & $npmCmd install --omit=dev 2>&1 | ForEach-Object { Write-Host "       $_" }
            if ($LASTEXITCODE -ne 0) { throw 'npm install failed' }
            Write-Host '[ok]   Dependencies installed'
        }
    } finally { Pop-Location }

    # --- 5b. Set up update source (git clone for admin self-update) -----------
    $gitExe = Find-Cmd 'git' @('C:\Program Files\Git\bin\git.exe', 'C:\Program Files\Git\cmd\git.exe')
    $updateSrc = "$InstallRoot\.update-source"
    if (-not $gitExe) {
        Write-Host '[!!]   git not found -- admin "Update Now" will not work until git is on PATH'
    } else {
        if (Test-Path "$updateSrc\.git") {
            Write-Host '[..]   Refreshing update-source repo (git pull)'
            & $gitExe -C $updateSrc pull --ff-only 2>&1 | Out-Null
            Write-Host '[ok]   Update source refreshed'
        } else {
            Write-Host '[..]   Cloning repo to .update-source (one-time, ~5 MB shallow)'
            & $gitExe clone --depth 50 'https://github.com/bonitobonita24/Yelli-Basic.git' $updateSrc 2>&1 | Out-Null
            if ($LASTEXITCODE -ne 0) {
                Write-Host '[!!]   git clone failed; admin "Update Now" will not work until fixed'
            } else {
                Write-Host '[ok]   Update source ready'
            }
        }
    }

    # --- 6. Generate cert for current LAN IP ------------------------------------
    & "$InstallRoot\deploy\windows\regen-cert.ps1" -InstallRoot $InstallRoot -OpensslExe $opensslExe

    # --- 7. (Re)install NSSM service --------------------------------------------
    if (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue) {
        Write-Host '[..]   Stopping existing service for update'
        & $nssmExe stop   $ServiceName confirm 2>&1 | Out-Null
        & $nssmExe remove $ServiceName confirm | Out-Null
    }

    $wrapper = "$InstallRoot\deploy\windows\start-yelli.ps1"
    $psArgs  = "-NoProfile -ExecutionPolicy Bypass -File `"$wrapper`""
    & $nssmExe install $ServiceName 'powershell.exe' $psArgs | Out-Null
    & $nssmExe set $ServiceName AppDirectory       $InstallRoot                            | Out-Null
    & $nssmExe set $ServiceName AppEnvironmentExtra "PORT=$Port" "APP_NAME=$AppName"      | Out-Null
    & $nssmExe set $ServiceName Start              SERVICE_AUTO_START                      | Out-Null
    & $nssmExe set $ServiceName AppKillProcessTree 1                                       | Out-Null
    & $nssmExe set $ServiceName AppStdout          "$InstallRoot\logs\service.log"         | Out-Null
    & $nssmExe set $ServiceName AppStderr          "$InstallRoot\logs\service.log"         | Out-Null
    & $nssmExe set $ServiceName AppRotateFiles     1                                       | Out-Null
    & $nssmExe set $ServiceName AppRotateBytes     5242880                                 | Out-Null
    & $nssmExe set $ServiceName Description "Yelli LAN video intercom - auto-starts at boot" | Out-Null
    New-Item -ItemType Directory -Force -Path "$InstallRoot\logs" | Out-Null
    Write-Host '[ok]   Service installed'

    # --- 8. Firewall ------------------------------------------------------------
    $ruleName = "Yelli LAN $Port"
    if (-not (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue)) {
        New-NetFirewallRule -DisplayName $ruleName -Direction Inbound `
            -LocalPort $Port -Protocol TCP -Action Allow | Out-Null
        Write-Host '[ok]   Firewall rule added'
    } else {
        Write-Host '[ok]   Firewall rule already present'
    }

    # --- 9. IP-change watchdog (scheduled task) --------------------------------
    $taskName = 'YelliIpWatchdog'
    if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    }
    $watchScript = "$InstallRoot\deploy\windows\watch-ip.ps1"
    $taskAction  = New-ScheduledTaskAction -Execute 'powershell.exe' `
        -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$watchScript`""
    $taskTrigger1 = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
        -RepetitionInterval (New-TimeSpan -Minutes 5)
    $taskTrigger2 = New-ScheduledTaskTrigger -AtStartup
    $taskPrincipal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -RunLevel Highest
    $taskSettings  = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
        -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 2)
    Register-ScheduledTask -TaskName $taskName `
        -Action $taskAction -Trigger @($taskTrigger1, $taskTrigger2) `
        -Principal $taskPrincipal -Settings $taskSettings `
        -Description 'Yelli: watches for LAN IP changes; refreshes cert and restarts service when needed.' | Out-Null
    Write-Host '[ok]   IP watchdog scheduled (every 5 min + at boot)'

    # --- 10. Start --------------------------------------------------------------
    Write-Host '[..]   Starting service'
    & $nssmExe start $ServiceName | Out-Null
    Start-Sleep -Seconds 2
    $svc = Get-Service -Name $ServiceName

    Write-Host ''
    Write-Host '======================================================='
    Write-Host "  DONE  -  Service '$ServiceName' is $($svc.Status)"
    Write-Host ''
    Write-Host '  Open from any device on this WiFi/LAN:'
    Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object {
            $_.PrefixOrigin -in 'Dhcp','Manual' -and
            $_.IPAddress -notlike '169.*' -and
            $_.IPAddress -notlike '127.*' -and
            $_.InterfaceAlias -notmatch 'WSL|Loopback|VMware|vEthernet|Hyper-V|Bluetooth'
        } | ForEach-Object { Write-Host "    https://$($_.IPAddress):$Port" }
    Write-Host ''
    Write-Host "  Logs: $InstallRoot\logs\service.log"
    Write-Host '  Reboot the PC (no sign-in needed) to confirm auto-start.'
    Write-Host '======================================================='
    Write-Host ''
    Read-Host 'Press Enter to close this window'

} catch {
    Write-Host ''
    Write-Host '======================================================='
    Write-Host "  INSTALL FAILED" -ForegroundColor Red
    Write-Host "  $_" -ForegroundColor Red
    Write-Host '======================================================='
    Write-Host ''
    Read-Host 'Press Enter to close this window'
    exit 1
}
