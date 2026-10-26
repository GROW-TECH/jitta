$ErrorActionPreference = "Stop"

$workspaceRoot = "c:\Users\Admin\Downloads\jitadriverslatest"
$appRoot = Join-Path $workspaceRoot "jitadriverslatest"
$distAssets = Join-Path $workspaceRoot "redtaxi\jittadrives\dist\assets"
$stagingRoot = Join-Path $workspaceRoot "staging_build"
$stagingApp = Join-Path $stagingRoot "jitadriverslatest"

Write-Host "1. Cleaning previous staging build..."
if (Test-Path $stagingRoot) {
    Remove-Item -Path $stagingRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $stagingApp -Force | Out-Null

Write-Host "2. Copying core directories..."
$coreDirs = @(
    "admin",
    "api",
    "config",
    "controllers",
    "middleware",
    "models",
    "routes",
    "services",
    "utils",
    "vehicles",
    "jittadrives"
)

foreach ($dir in $coreDirs) {
    $src = Join-Path $appRoot $dir
    if (Test-Path $src) {
        $dest = Join-Path $stagingApp $dir
        Copy-Item -Path $src -Destination $dest -Recurse -Force
        Write-Host "   -> Copied directory: $dir"
    } else {
        Write-Warning "Directory not found: $dir"
    }
}

Write-Host "3. Creating clean assets directory..."
$stagingAssets = Join-Path $stagingApp "assets"
New-Item -ItemType Directory -Path $stagingAssets -Force | Out-Null

# Copy clean frontend build assets from dist
Get-ChildItem -Path $distAssets | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination $stagingAssets -Force
    Write-Host "   -> Added frontend asset: $($_.Name)"
}

# Copy admin assets
$adminAssets = Join-Path $appRoot "admin\assets"
if (Test-Path $adminAssets) {
    Get-ChildItem -Path $adminAssets | ForEach-Object {
        Copy-Item -Path $_.FullName -Destination $stagingAssets -Force
        Write-Host "   -> Added admin asset: $($_.Name)"
    }
}

Write-Host "4. Copying root files..."
$rootFiles = @(
    ".htaccess",
    ".env.example",
    "index.html",
    "index.php",
    "router_frontend.php",
    "favicon.svg",
    "icons.svg",
    "logo.png",
    "verify_connection.php",
    "import_db_live.php",
    "jitta_production_database.sql",
    "places_master_data.sql",
    "migrate.php",
    "migrate_driver_only.php",
    "migrate_places.php",
    "seed_places.php",
    "setup.php"
)

foreach ($file in $rootFiles) {
    $src = Join-Path $appRoot $file
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination $stagingApp -Force
        Write-Host "   -> Copied file: $file"
    } else {
        Write-Warning "File not found: $file"
    }
}

Write-Host "5. Creating zip archives with .NET ZipFile..."
Add-Type -AssemblyName System.IO.Compression.FileSystem

# Wait 1 second to ensure all file handles are closed
Start-Sleep -Seconds 1

# Zip 1: With top-level jitadriverslatest/ folder (for extracting into /public_html/)
$zip1Path = Join-Path $workspaceRoot "jitadriverslatest_production_v2.zip"
if (Test-Path $zip1Path) { Remove-Item $zip1Path -Force }
Write-Host "   Creating $zip1Path (with root folder jitadriverslatest)..."
[System.IO.Compression.ZipFile]::CreateFromDirectory($stagingApp, $zip1Path, [System.IO.Compression.CompressionLevel]::Optimal, $true)
$size1 = [Math]::Round((Get-Item $zip1Path).Length / 1MB, 2)
Write-Host "   -> Successfully created $zip1Path ($size1 MB)"

# Zip 2: Direct contents (for extracting inside /public_html/jitadriverslatest/)
$zip2Path = Join-Path $workspaceRoot "jitadriverslatest_direct_extract.zip"
if (Test-Path $zip2Path) { Remove-Item $zip2Path -Force }
Write-Host "   Creating $zip2Path (direct files without wrapper folder)..."
[System.IO.Compression.ZipFile]::CreateFromDirectory($stagingApp, $zip2Path, [System.IO.Compression.CompressionLevel]::Optimal, $false)
$size2 = [Math]::Round((Get-Item $zip2Path).Length / 1MB, 2)
Write-Host "   -> Successfully created $zip2Path ($size2 MB)"

Write-Host "`nAll zips generated successfully!"
