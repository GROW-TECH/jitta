$zipFile = "C:\Users\Admin\Downloads\jitadriverslatest\jitta_cpanel_changed_files_only.zip"
if (Test-Path $zipFile) { Remove-Item $zipFile -Force }

$tempDir = "C:\Users\Admin\Downloads\jitadriverslatest\temp_cpanel_package"
if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
New-Item -ItemType Directory -Path $tempDir -Force

$backendDir = "C:\Users\Admin\Downloads\jitadriverslatest\jitadriverslatest"
$foldersToCopy = @("admin", "assets", "controllers", "models", "services", "routes", "config", "utils", "middleware", "cron")
foreach ($folder in $foldersToCopy) {
    if (Test-Path "$backendDir\$folder") {
        Copy-Item -Path "$backendDir\$folder" -Destination "$tempDir\$folder" -Recurse -Force
    }
}

$filesToCopy = @("index.html", "index.php", "logo.png", ".htaccess")
foreach ($file in $filesToCopy) {
    if (Test-Path "$backendDir\$file") {
        Copy-Item -Path "$backendDir\$file" -Destination "$tempDir\$file" -Force
    }
}

Compress-Archive -Path "$tempDir\*" -DestinationPath $zipFile -Force
Remove-Item $tempDir -Recurse -Force
Write-Host "SUCCESS: Created $zipFile"

