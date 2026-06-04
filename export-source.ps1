# .\export-source.ps1 -Output "plexus-source-export.md" -UseGit
param(
    [string]$Root = ".",
    [string]$Output = "source-export.md",
    [switch]$UseGit
)

$ErrorActionPreference = "Stop"

$IncludeExtensions = @(
    ".ts", ".tsx", ".mts", ".cts",
    ".js", ".jsx", ".mjs", ".cjs",
    ".css", ".scss", ".html",
    ".json", ".md", ".mdx",
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

function Get-SourceLineCount {
    param([System.IO.FileInfo]$File)

    $lineCount = 0
    $reader = [System.IO.File]::OpenText($File.FullName)

    try {
        while ($null -ne $reader.ReadLine()) {
            $lineCount++
        }
    } finally {
        $reader.Close()
    }

    return $lineCount
}

function Get-FileCategory {
    param([System.IO.FileInfo]$File)

    $ext = $File.Extension.ToLower()

    if (@(".ts", ".tsx", ".mts", ".cts") -contains $ext) {
        return "TypeScript"
    }

    if (@(".js", ".jsx", ".mjs", ".cjs") -contains $ext) {
        return "JavaScript"
    }

    if (@(".md", ".mdx") -contains $ext) {
        return "Dokumentacio"
    }

    return "Egyeb"
}

function Format-Kb {
    param([long]$Bytes)
    return "{0:N1}" -f ($Bytes / 1KB)
}

function Write-Separator {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor DarkGray
}

function Write-StatRow {
    param(
        [string]$Label,
        [int]$Files,
        [int]$Lines,
        [long]$Bytes
    )

    $kb = Format-Kb $Bytes
    Write-Host ("{0,-16} {1,8} fajl {2,10} sor {3,10} KB" -f $Label, $Files, $Lines, $kb)
}

$RootPath = Resolve-Path $Root
$OutputPath = Join-Path $RootPath $Output

Write-Separator
Write-Host "Plexus source export inditasa" -ForegroundColor Cyan
Write-Host "Gyoker:  $RootPath"
Write-Host "Kimenet: $OutputPath"
Write-Host "Forras:  $(if ($UseGit) { 'git ls-files' } else { 'fajlrendszer' })"

if (Test-Path $OutputPath) {
    Remove-Item $OutputPath -Force
}

"# Source Export" | Out-File $OutputPath -Encoding UTF8
"`nRoot: $RootPath`nGenerated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n" | Out-File $OutputPath -Append -Encoding UTF8

if ($UseGit) {
    $files = git -C $RootPath ls-files | ForEach-Object {
        $path = Join-Path $RootPath $_
        if (Test-Path $path) {
            Get-Item $path
        }
    } | Where-Object {
        Should-IncludeFile $_
    }
} else {
    $files = Get-ChildItem $RootPath -Recurse -File | Where-Object {
        Should-IncludeFile $_
    }
}

$files = @($files | Sort-Object FullName)
$fileStats = @{}
$totals = @{
    TypeScript = @{ Files = 0; Lines = 0; Bytes = 0L }
    JavaScript = @{ Files = 0; Lines = 0; Bytes = 0L }
    Dokumentacio = @{ Files = 0; Lines = 0; Bytes = 0L }
    Egyeb = @{ Files = 0; Lines = 0; Bytes = 0L }
    Osszesen = @{ Files = 0; Lines = 0; Bytes = 0L }
}

foreach ($file in $files) {
    $lineCount = Get-SourceLineCount $file
    $category = Get-FileCategory $file
    $bytes = $file.Length

    $fileStats[$file.FullName] = @{
        Lines = $lineCount
        Bytes = $bytes
        Category = $category
    }

    $totals[$category].Files++
    $totals[$category].Lines += $lineCount
    $totals[$category].Bytes += $bytes

    $totals.Osszesen.Files++
    $totals.Osszesen.Lines += $lineCount
    $totals.Osszesen.Bytes += $bytes
}

"`n## Osszesites`n" | Out-File $OutputPath -Append -Encoding UTF8
"| Kategoria | Fajlok | Sorok | Meret KB |" | Out-File $OutputPath -Append -Encoding UTF8
"|---|---:|---:|---:|" | Out-File $OutputPath -Append -Encoding UTF8
foreach ($category in @("TypeScript", "JavaScript", "Dokumentacio", "Egyeb", "Osszesen")) {
    $stat = $totals[$category]
    "| $category | $($stat.Files) | $($stat.Lines) | $(Format-Kb $stat.Bytes) |" | Out-File $OutputPath -Append -Encoding UTF8
}

"`n## Project Structure`n" | Out-File $OutputPath -Append -Encoding UTF8

foreach ($file in $files) {
    $relative = Resolve-Path $file.FullName -Relative
    $stat = $fileStats[$file.FullName]
    $kb = Format-Kb $stat.Bytes
    "- $relative ($($stat.Category), $($stat.Lines) sor, $kb KB)" | Out-File $OutputPath -Append -Encoding UTF8
}

foreach ($file in $files) {
    $relative = Resolve-Path $file.FullName -Relative
    $ext = $file.Extension.TrimStart(".").ToLower()
    $stat = $fileStats[$file.FullName]
    $kb = Format-Kb $stat.Bytes

    "`n---`n" | Out-File $OutputPath -Append -Encoding UTF8
    "## $relative`n" | Out-File $OutputPath -Append -Encoding UTF8
    "Kategoria: $($stat.Category)  " | Out-File $OutputPath -Append -Encoding UTF8
    "Sorok: $($stat.Lines)  " | Out-File $OutputPath -Append -Encoding UTF8
    "Meret: $kb KB`n" | Out-File $OutputPath -Append -Encoding UTF8
    "````$ext" | Out-File $OutputPath -Append -Encoding UTF8
    Get-Content $file.FullName -Raw | Out-File $OutputPath -Append -Encoding UTF8
    "````" | Out-File $OutputPath -Append -Encoding UTF8
}

Write-Separator
Write-Host "Export kesz" -ForegroundColor Green
Write-Host "Kimeneti fajl: $OutputPath"
Write-Separator
Write-Host "Osszesites" -ForegroundColor Cyan
Write-StatRow "TypeScript" $totals.TypeScript.Files $totals.TypeScript.Lines $totals.TypeScript.Bytes
Write-StatRow "JavaScript" $totals.JavaScript.Files $totals.JavaScript.Lines $totals.JavaScript.Bytes
Write-StatRow "Dokumentacio" $totals.Dokumentacio.Files $totals.Dokumentacio.Lines $totals.Dokumentacio.Bytes
Write-StatRow "Egyeb" $totals.Egyeb.Files $totals.Egyeb.Lines $totals.Egyeb.Bytes
Write-Host "------------------------------------------------------------" -ForegroundColor DarkGray
Write-StatRow "Osszesen" $totals.Osszesen.Files $totals.Osszesen.Lines $totals.Osszesen.Bytes
Write-Separator
