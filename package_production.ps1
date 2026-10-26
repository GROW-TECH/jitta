$src = "c:\Users\Admin\Downloads\jitadriverslatest\jitadriverslatest"
$staging = "c:\Users\Admin\Downloads\jitadriverslatest\staging_prod"
$zipPath = "c:\Users\Admin\Downloads\jitadriverslatest\jittadrivers_cpanel_upload.zip"

if (Test-Path $staging) {
    Remove-Item -Path $staging -Recurse -Force
}
New-Item -ItemType Directory -Path $staging -Force | Out-Null

Get-ChildItem -Path $src -Force | Where-Object {
    $_.Name -ne '.env' -and $_.Name -ne 'jitta_production_database.sql'
} | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination $staging -Recurse -Force
}

if (Test-Path $zipPath) {
    Remove-Item -Path $zipPath -Force
}

Set-Location $staging
tar -a -cf $zipPath *

$zipItem = Get-Item $zipPath
$zipMb = [math]::Round($zipItem.Length / 1MB, 2)
Write-Host "ZIP created successfully: $zipPath ($zipMb MB)"
