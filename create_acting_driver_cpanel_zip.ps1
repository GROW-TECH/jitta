$zipPath = "c:\Users\Admin\Downloads\jitadriverslatest\cpanel_acting_driver_fix.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

$staging = "c:\Users\Admin\Downloads\jitadriverslatest\staging_acting_driver_fix"
if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
New-Item -ItemType Directory -Path $staging -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $staging "controllers") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $staging "assets") -Force | Out-Null

# 1. Copy Frontend index.html
Copy-Item "c:\Users\Admin\Downloads\jitadriverslatest\jitadriverslatest\index.html" (Join-Path $staging "index.html") -Force

# 2. Copy compiled assets
Get-ChildItem "c:\Users\Admin\Downloads\jitadriverslatest\redtaxi\jittadrives\dist\assets" | ForEach-Object {
    Copy-Item $_.FullName (Join-Path $staging "assets") -Force
}

# 3. Copy modified Backend BookingController
Copy-Item "c:\Users\Admin\Downloads\jitadriverslatest\jitadriverslatest\controllers\BookingController.php" (Join-Path $staging "controllers\BookingController.php") -Force

# 4. Create ZIP
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($staging, $zipPath)

$zipItem = Get-Item $zipPath
$zipMb = [math]::Round($zipItem.Length / 1MB, 2)
Write-Host "ZIP created successfully: $zipPath ($zipMb MB)"

# Also update cpanel_changed_files_only.zip as well
$cpanelChangedZip = "c:\Users\Admin\Downloads\jitadriverslatest\cpanel_changed_files_only.zip"
Copy-Item $zipPath $cpanelChangedZip -Force
Write-Host "Updated cpanel_changed_files_only.zip as well"
