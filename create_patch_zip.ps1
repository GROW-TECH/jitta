Add-Type -AssemblyName System.IO.Compression.FileSystem
$patchZip = 'c:\Users\Admin\Downloads\jitadriverslatest\patch_php56_fix.zip'
if (Test-Path $patchZip) { Remove-Item $patchZip -Force }

$tempDir = 'c:\Users\Admin\Downloads\jitadriverslatest\temp_patch'
if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
New-Item -ItemType Directory -Path "$tempDir\controllers" -Force | Out-Null
New-Item -ItemType Directory -Path "$tempDir\services" -Force | Out-Null

Copy-Item 'c:\Users\Admin\Downloads\jitadriverslatest\jitadriverslatest\controllers\LookupController.php' "$tempDir\controllers\" -Force
Copy-Item 'c:\Users\Admin\Downloads\jitadriverslatest\jitadriverslatest\services\PlacesSearchService.php' "$tempDir\services\" -Force

[System.IO.Compression.ZipFile]::CreateFromDirectory($tempDir, $patchZip, [System.IO.Compression.CompressionLevel]::Optimal, $false)
Remove-Item $tempDir -Recurse -Force

Write-Host "Created $patchZip ($((Get-Item $patchZip).Length) bytes)"
