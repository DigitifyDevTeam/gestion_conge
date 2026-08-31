param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('local', 'production')]
    [string]$Env
)

$backend = Join-Path $PSScriptRoot "backend"
$activeFile = Join-Path $backend ".env.active"
$sourceFile = Join-Path $backend ".env.$Env"

if (-not (Test-Path $sourceFile)) {
    $example = Join-Path $backend ".env.$Env.example"
    if (Test-Path $example) {
        Copy-Item $example $sourceFile
        Write-Host "Created $sourceFile from example — edit it with your values."
    } else {
        Write-Error "Missing $sourceFile"
        exit 1
    }
}

Set-Content -Path $activeFile -Value $Env -NoNewline
Write-Host "Active environment: $Env"
Write-Host "Loaded from: backend\.env.$Env"
Write-Host "Restart Django (runserver) if it is already running."
