# .\export-source.ps1 -Output "plexus-source-export.md" -UseGit
param(
    [string]$Root = ".",
    [string]$Output = "source-export.md",
    [switch]$UseGit
)

$ErrorActionPreference = "Stop"

$IncludeExtensions = @(
    ".ts", ".tsx", ".js", ".jsx",
    ".css", ".scss", ".html",
    ".json", ".md",
    ".svg",
    ".ps1", ".sh",
    ".yml", ".yaml"
)

$ExcludeDirs = @(
    "node_modules",
    "dist",
    "build",
    ".git",
    ".vite",
    ".cache",
    "coverage"
)

$ExcludeFiles = @(
    "package-lock.json",
    "bun.lock",
    "vite-dev.log",
    "vite-dev.err.log",
    "vite-smoke.out.log",
    "vite-smoke.err.log"
)

function Should-IncludeFile {
    param([System.IO.FileInfo]$File)

    if ($ExcludeFiles -contains $File.Name) {
        return $false
    }

    if ($IncludeExtensions -notcontains $File.Extension.ToLower()) {
        return $false
    }

    foreach ($dir in $ExcludeDirs) {
        if ($File.FullName -match "\\$([regex]::Escape($dir))\\") {
            return $false
        }
    }

    return $true
}

$RootPath = Resolve-Path $Root
$OutputPath = Join-Path $RootPath $Output

if (Test-Path $OutputPath) {
    Remove-Item $OutputPath -Force
}

"# Source Export" | Out-File $OutputPath -Encoding UTF8
"`nRoot: $RootPath`nGenerated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n" | Out-File $OutputPath -Append -Encoding UTF8

if ($UseGit) {
    $files = git -C $RootPath ls-files | ForEach-Object {
        Get-Item (Join-Path $RootPath $_)
    } | Where-Object {
        Should-IncludeFile $_
    }
} else {
    $files = Get-ChildItem $RootPath -Recurse -File | Where-Object {
        Should-IncludeFile $_
    }
}

$files = $files | Sort-Object FullName

"`n## Project Structure`n" | Out-File $OutputPath -Append -Encoding UTF8

foreach ($file in $files) {
    $relative = Resolve-Path $file.FullName -Relative
    "- $relative" | Out-File $OutputPath -Append -Encoding UTF8
}

foreach ($file in $files) {
    $relative = Resolve-Path $file.FullName -Relative
    $ext = $file.Extension.TrimStart(".").ToLower()

    "`n---`n" | Out-File $OutputPath -Append -Encoding UTF8
    "## $relative`n" | Out-File $OutputPath -Append -Encoding UTF8
    "````$ext" | Out-File $OutputPath -Append -Encoding UTF8
    Get-Content $file.FullName -Raw | Out-File $OutputPath -Append -Encoding UTF8
    "````" | Out-File $OutputPath -Append -Encoding UTF8
}

Write-Host "Kész: $OutputPath"
Write-Host "Fájlok száma: $($files.Count)"