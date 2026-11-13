#Requires -RunAsAdministrator
[CmdletBinding()]
param([ValidateRange(1, 65535)][int]$Port = 22)

$ErrorActionPreference = 'Stop'

# Run on the Windows server itself, in an elevated Windows PowerShell window.
# Uses the existing Windows account password; never reads or changes it.
Write-Host 'Installing Windows OpenSSH Server...'
$capability = Get-WindowsCapability -Online -Name 'OpenSSH.Server~~~~0.0.1.0'
if ($capability.State -ne 'Installed') {
    $installation = Add-WindowsCapability -Online -Name 'OpenSSH.Server~~~~0.0.1.0'
    if ($installation.RestartNeeded) {
        throw 'Windows requires a restart. Restart the server, then run this script again.'
    }
}

$sshDirectory = Join-Path $env:ProgramData 'ssh'
$openSshDirectory = Join-Path $env:WINDIR 'System32\OpenSSH'
$configuration = Join-Path $sshDirectory 'sshd_config'
$sshdExecutable = Join-Path $openSshDirectory 'sshd.exe'
$keygenExecutable = Join-Path $openSshDirectory 'ssh-keygen.exe'
New-Item -ItemType Directory -Path $sshDirectory -Force | Out-Null
if (-not (Test-Path -LiteralPath $configuration)) {
    Copy-Item -LiteralPath (Join-Path $openSshDirectory 'sshd_config_default') -Destination $configuration
}

$backup = "$configuration.before-password-$(Get-Date -Format 'yyyyMMdd-HHmmss-fff').bak"
Copy-Item -LiteralPath $configuration -Destination $backup
$original = [System.IO.File]::ReadAllText($configuration)
# Modify global settings only. Keep Match sections and all unrelated settings intact.
$inMatch = $false
$remaining = foreach ($line in ($original -split '\r?\n')) {
    if ($line -match '^\s*Match\s+') { $inMatch = $true }
    if (-not $inMatch -and $line -match '^\s*(Port|PasswordAuthentication)\s+') { continue }
    $line
}
$updated = "Port $Port`r`nPasswordAuthentication yes`r`n" + ($remaining -join "`r`n")
[System.IO.File]::WriteAllText($configuration, $updated, [System.Text.UTF8Encoding]::new($false))

try {
    & $keygenExecutable -A
    if ($LASTEXITCODE -ne 0) { throw 'Failed to generate SSH host keys.' }
    & $sshdExecutable -t -f $configuration
    if ($LASTEXITCODE -ne 0) { throw 'OpenSSH configuration validation failed.' }
    $effective = & $sshdExecutable -T -f $configuration -C 'user=administrator,host=localhost,addr=127.0.0.1'
    if ($LASTEXITCODE -ne 0 -or $effective -notcontains 'passwordauthentication yes') {
        throw 'An existing Match rule prevents Administrator password login. Configuration restored.'
    }
} catch {
    Copy-Item -LiteralPath $backup -Destination $configuration -Force
    throw
}

Set-Service -Name sshd -StartupType Automatic
$ruleName = "OpenSSH-Password-Server-TCP-$Port"
if (Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue) {
    Set-NetFirewallRule -Name $ruleName -Enabled True -Direction Inbound -Action Allow -Profile Any
    Get-NetFirewallRule -Name $ruleName | Get-NetFirewallPortFilter | Set-NetFirewallPortFilter -Protocol TCP -LocalPort $Port
} else {
    New-NetFirewallRule -Name $ruleName -DisplayName "OpenSSH Server TCP $Port" -Enabled True -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Any | Out-Null
}
Restart-Service -Name sshd
(Get-Service sshd).WaitForStatus('Running', [TimeSpan]::FromSeconds(10))
$listener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
if (-not $listener) { throw "sshd started but TCP port $Port is not listening. Check the OpenSSH event log." }

Write-Host ''
Write-Host "OpenSSH is running on TCP $Port. Password authentication is enabled."
Write-Host 'Sign in with Administrator and its existing Windows password.'
Write-Host "Configuration backup: $backup"
Write-Host "If this is a cloud server, also allow inbound TCP $Port in its security group."
Write-Host "Connect from your computer: ssh -p $Port administrator@39.104.86.15"
