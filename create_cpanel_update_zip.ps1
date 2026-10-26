# Script to build frontend and package into cPanel update ZIP
Set-Location "c:\Users\Admin\Downloads\jitadriverslatest\redtaxi\jittadrives"

Write-Host "1. Building Vite production bundle..."
& npm.cmd run build

Write-Host "2. Syncing built frontend to PHP root (jitadriverslatest)..."
$phpRoot = "c:\Users\Admin\Downloads\jitadriverslatest\jitadriverslatest"
Copy-Item "dist\index.html" "$phpRoot\index.html" -Force
Copy-Item "public\terms-and-conditions.html" "$phpRoot\terms-and-conditions.html" -Force
Copy-Item "public\privacy-policy.html" "$phpRoot\privacy-policy.html" -Force
Copy-Item "public\delete-account.html" "$phpRoot\delete-account.html" -Force
Copy-Item "public\jitta_hero_fleet.jpg" "$phpRoot\jitta_hero_fleet.jpg" -Force
Copy-Item "public\terms-and-conditions.html" "..\..\jitadriverslatest\terms-and-conditions.html" -Force

# Sync assets
if (Test-Path "$phpRoot\assets") { Remove-Item "$phpRoot\assets\*" -Recurse -Force }
Copy-Item -Path "dist\assets\*" -Destination "$phpRoot\assets" -Recurse -Force

Write-Host "3. Packaging cPanel ZIP..."
$zipPath1 = "C:\Users\Admin\Downloads\jitta_cpanel_live_update.zip"
$zipPath2 = "c:\Users\Admin\Downloads\jitadriverslatest\jitta_cpanel_live_update.zip"
if (Test-Path $zipPath1) { Remove-Item $zipPath1 -Force }
if (Test-Path $zipPath2) { Remove-Item $zipPath2 -Force }

$staging = "c:\Users\Admin\Downloads\jitadriverslatest\staging_cpanel_update"
if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
New-Item -ItemType Directory -Path $staging -Force | Out-Null

# Copy everything from dist into staging
Copy-Item -Path "dist\*" -Destination $staging -Recurse -Force

# Create Full ZIP
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($staging, $zipPath1)
Copy-Item $zipPath1 $zipPath2 -Force

if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }

$zipItem = Get-Item $zipPath1
$zipMb = [math]::Round($zipItem.Length / 1MB, 2)
Write-Host "SUCCESS: Created $zipPath1 ($zipMb MB)"

# 4. Packaging Changed Files Only ZIP (Lightweight)
Write-Host "4. Packaging Changed Files Only ZIP..."
$patchZip1 = "C:\Users\Admin\Downloads\jitta_cpanel_changed_files_only.zip"
$patchZip2 = "c:\Users\Admin\Downloads\jitadriverslatest\jitta_cpanel_changed_files_only.zip"
if (Test-Path $patchZip1) { Remove-Item $patchZip1 -Force }
if (Test-Path $patchZip2) { Remove-Item $patchZip2 -Force }

$patchStaging = "c:\Users\Admin\Downloads\jitadriverslatest\staging_patch_only"
if (Test-Path $patchStaging) { Remove-Item $patchStaging -Recurse -Force }
New-Item -ItemType Directory -Path $patchStaging -Force | Out-Null
New-Item -ItemType Directory -Path "$patchStaging\assets" -Force | Out-Null

Copy-Item "dist\index.html" "$patchStaging\index.html" -Force
Copy-Item "public\terms-and-conditions.html" "$patchStaging\terms-and-conditions.html" -Force
Copy-Item -Path "dist\assets\*" -Destination "$patchStaging\assets" -Recurse -Force

[System.IO.Compression.ZipFile]::CreateFromDirectory($patchStaging, $patchZip1)
Copy-Item $patchZip1 $patchZip2 -Force
if (Test-Path $patchStaging) { Remove-Item $patchStaging -Recurse -Force }

$patchItem = Get-Item $patchZip1
$patchMb = [math]::Round($patchItem.Length / 1MB, 2)
Write-Host "SUCCESS: Created Changed Files Only ZIP: $patchZip1 ($patchMb MB)"
