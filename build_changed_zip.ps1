$destZip = "c:\Users\Admin\Downloads\jitadriverslatest\cpanel_changed_files_only.zip"
if (Test-Path $destZip) { Remove-Item $destZip -Force }

$staging = "c:\Users\Admin\Downloads\jitadriverslatest\staging_changed"
if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
New-Item -ItemType Directory -Path $staging -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $staging "config") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $staging "models") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $staging "assets") -Force | Out-Null

Copy-Item "c:\Users\Admin\Downloads\jitadriverslatest\jitadriverslatest\index.php" (Join-Path $staging "index.php") -Force
Copy-Item "c:\Users\Admin\Downloads\jitadriverslatest\jitadriverslatest\router_frontend.php" (Join-Path $staging "router_frontend.php") -Force
Copy-Item "c:\Users\Admin\Downloads\jitadriverslatest\jitadriverslatest\config\env.php" (Join-Path $staging "config\env.php") -Force
Copy-Item "c:\Users\Admin\Downloads\jitadriverslatest\jitadriverslatest\models\DriverModel.php" (Join-Path $staging "models\DriverModel.php") -Force
Copy-Item "c:\Users\Admin\Downloads\jitadriverslatest\jitadriverslatest\index.html" (Join-Path $staging "index.html") -Force

# Copy latest assets
Get-ChildItem "c:\Users\Admin\Downloads\jitadriverslatest\redtaxi\jittadrives\dist\assets" | ForEach-Object {
    Copy-Item $_.FullName (Join-Path $staging "assets") -Force
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($staging, $destZip)

Write-Host "Zip created successfully at $destZip"
Get-Item $destZip | Select-Object Name, Length, LastWriteTime | Format-List
