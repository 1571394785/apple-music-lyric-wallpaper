param([ValidateRange(1, 65535)][int]$Port = 22)

$ErrorActionPreference = 'Stop'
$archive = Join-Path $env:TEMP ("portable-ssh-" + [guid]::NewGuid().ToString('N') + '.gz')
$temporaryExecutable = [System.IO.Path]::ChangeExtension($archive, '.exe')
$programDirectory = Join-Path $PSScriptRoot 'portable-ssh'
$executable = Join-Path $programDirectory 'sshd-lite-1.55.4.exe'
$url = 'https://github.com/jpillora/sshd-lite/releases/download/v1.55.4/sshd-lite_1.55.4_windows_amd64.gz'
$archiveSha256 = '02142bfab2e6f8b08be07b73b73bad05245ea95c29dfb9248ed62932d9a85477'

try {
    if (-not (Test-Path -LiteralPath $executable)) {
        New-Item -ItemType Directory -Path $programDirectory -Force | Out-Null
        Write-Host 'Downloading sshd-lite (first run only)...'
        Invoke-WebRequest -Uri $url -OutFile $archive -UseBasicParsing
        if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $archiveSha256) {
            throw 'Download checksum verification failed.'
        }
        $source = [System.IO.File]::OpenRead($archive)
        try {
            $gzip = [System.IO.Compression.GZipStream]::new($source, [System.IO.Compression.CompressionMode]::Decompress)
            try {
                $destination = [System.IO.File]::Create($temporaryExecutable)
                try { $gzip.CopyTo($destination) } finally { $destination.Dispose() }
            } finally { $gzip.Dispose() }
        } finally { $source.Dispose() }
        Move-Item -LiteralPath $temporaryExecutable -Destination $executable
    } else {
        Write-Host "Using locally saved program: $executable"
    }

    $credentials = Get-Credential -Message 'Choose an SSH username and password (independent from the Windows account).'
    if (-not $credentials) { throw 'Startup cancelled.' }
    $username = $credentials.UserName
    $password = $credentials.GetNetworkCredential().Password
    if ([string]::IsNullOrWhiteSpace($username) -or $username.Contains(':') -or [string]::IsNullOrWhiteSpace($password)) {
        throw 'Username must not be empty or contain a colon; password must not be empty.'
    }
    Write-Host "Starting SSH in the foreground. Port: $Port. Username: $username"
    Write-Host 'Keep this window open. Press Ctrl+C to stop. Remote commands use this Windows user account.'
    # sshd-lite requires credentials as a command-line argument; local administrators can inspect it.
    & $executable --port $Port --sftp "${username}:$password"
} finally {
    $password = $null
    Remove-Item -LiteralPath $archive, $temporaryExecutable -Force -ErrorAction SilentlyContinue
}
