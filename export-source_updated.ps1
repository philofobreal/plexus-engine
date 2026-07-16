# .\export-source_updated.ps1 -Output "plexus-source-export.md" -UseGit
param(
    [string]$Root = ".",
    [string]$Output = "source-export.md",
    [switch]$UseGit
)

$ErrorActionPreference = "Stop"

$AllExtensions = @(
    ".ts", ".tsx", ".mts", ".cts",
    ".js", ".jsx", ".mjs", ".cjs",
    ".css", ".scss", ".html",
    ".json", ".md", ".mdx", ".txt",
    ".svg",
    ".ps1", ".sh",
    ".yml", ".yaml"
)

$DeveloperExtensions = @(
    ".ts", ".tsx", ".mts", ".cts",
    ".js", ".jsx", ".mjs", ".cjs",
    ".json"
)

$DocumentExtensions = @(
    ".md", ".mdx", ".txt"
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

function Select-ExportMode {
    Write-Host ""
    Write-Host "Mit gyujtsek ossze?" -ForegroundColor Cyan
    Write-Host "1 - Csak fejlesztoi fajlok (ts, js, json; tesztek nelkul)"
    Write-Host "2 - Csak teszt fajlok (*.spec.*, *.test.*, vite/vitest/jest tesztek)"
    Write-Host "3 - Csak dokumentumok (md, mdx, txt)"
    Write-Host "4 - Minden"
    Write-Host ""

    do {
        $choice = Read-Host "Valasztas [1-4]"
    } until ($choice -in @("1", "2", "3", "4"))

    switch ($choice) {
        "1" { return "developer" }
        "2" { return "test" }
        "3" { return "docs" }
        "4" { return "all" }
    }
}

function Get-ExportModeLabel {
    param([string]$Mode)

    switch ($Mode) {
        "developer" { return "Csak fejlesztoi fajlok" }
        "test" { return "Csak teszt fajlok" }
        "docs" { return "Csak dokumentumok" }
        "all" { return "Minden" }
    }
}

function Test-IsTestFile {
    param([System.IO.FileInfo]$File)

    $name = $File.Name.ToLower()
    $relative = $File.FullName.ToLower()

    if ($name -match "\.(spec|test)\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$") {
        return $true
    }


    if ($name -match "\.(e2e|cy)\.(ts|tsx|js|jsx|mjs|cjs)$") {
        return $true
    }

    if ($relative -match "[\\/](test|tests|__tests__|spec|specs|e2e|cypress)[\\/]") {
        return $true
    }

    return $false
}

function Should-IncludeFile {
    param(
        [System.IO.FileInfo]$File,
        [string]$Mode
    )

    if ($ExcludeFiles -contains $File.Name) {
        return $false
    }

    foreach ($dir in $ExcludeDirs) {
        if ($File.FullName -match "[\\/]$([regex]::Escape($dir))[\\/]") {
            return $false
        }
    }

    $ext = $File.Extension.ToLower()
    $isTest = Test-IsTestFile $File

    switch ($Mode) {
        "developer" {
            return (($DeveloperExtensions -contains $ext) -and (-not $isTest))
        }
        "test" {
            return (($DeveloperExtensions -contains $ext) -and $isTest)
        }
        "docs" {
            return ($DocumentExtensions -contains $ext)
        }
        "all" {
            return ($AllExtensions -contains $ext)
        }
    }

    return $false
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
    param(
        [System.IO.FileInfo]$File,
        [string]$Mode
    )

    $ext = $File.Extension.ToLower()

    # Az eredeti viselkedés megtartása: „Minden” módban a tesztfájlok
    # továbbra is a nyelvi kategóriájukba számítanak, nem külön Teszt sorba.
    # Külön Teszt kategória csak a „Csak teszt fájlok” módban jelenik meg.
    if (($Mode -eq "test") -and (Test-IsTestFile $File)) {
        return "Teszt"
    }

    if (@(".ts", ".tsx", ".mts", ".cts") -contains $ext) {
        return "TypeScript"
    }

    if (@(".js", ".jsx", ".mjs", ".cjs") -contains $ext) {
        return "JavaScript"
    }

    if (@(".md", ".mdx", ".txt") -contains $ext) {
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
$ExportMode = Select-ExportMode
$ExportModeLabel = Get-ExportModeLabel $ExportMode

Write-Separator
Write-Host "Plexus source export inditasa" -ForegroundColor Cyan
Write-Host "Gyoker:  $RootPath"
Write-Host "Kimenet: $OutputPath"
Write-Host "Mod:     $ExportModeLabel"
Write-Host "Forras:  $(if ($UseGit) { 'git ls-files' } else { 'fajlrendszer' })"

if (Test-Path $OutputPath) {
    Remove-Item $OutputPath -Force
}

"# Source Export" | Out-File $OutputPath -Encoding UTF8
"`nRoot: $RootPath`nMode: $ExportModeLabel`nGenerated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n" | Out-File $OutputPath -Append -Encoding UTF8

if ($UseGit) {
    $files = git -C $RootPath -c core.quotepath=false ls-files | ForEach-Object {
        $relativePath = $_.Trim()

        if ([string]::IsNullOrWhiteSpace($relativePath)) {
            return
        }

        $path = Join-Path -Path $RootPath -ChildPath $relativePath

        if (Test-Path -LiteralPath $path) {
            Get-Item -LiteralPath $path
        }
    } | Where-Object {
        $_ -and (Should-IncludeFile $_ $ExportMode)
    }
} else {
    $files = Get-ChildItem $RootPath -Recurse -File | Where-Object {
        Should-IncludeFile $_ $ExportMode
    }
}

$files = @($files | Sort-Object FullName)
$fileStats = @{}
$totals = @{
    TypeScript = @{ Files = 0; Lines = 0; Bytes = 0L }
    JavaScript = @{ Files = 0; Lines = 0; Bytes = 0L }
    Teszt = @{ Files = 0; Lines = 0; Bytes = 0L }
    Dokumentacio = @{ Files = 0; Lines = 0; Bytes = 0L }
    Egyeb = @{ Files = 0; Lines = 0; Bytes = 0L }
    Osszesen = @{ Files = 0; Lines = 0; Bytes = 0L }
}

foreach ($file in $files) {
    $lineCount = Get-SourceLineCount $file
    $category = Get-FileCategory $file $ExportMode
    $bytes = $file.Length

    $fileStats[$file.FullName] = @{
        Lines = $lineCount
        Bytes = $bytes
        Category = $category
    }

    ($totals[$category]).Files++
    ($totals[$category]).Lines += $lineCount
    ($totals[$category]).Bytes += $bytes

    $totals.Osszesen.Files++
    $totals.Osszesen.Lines += $lineCount
    $totals.Osszesen.Bytes += $bytes
}

"`n## Osszesites`n" | Out-File $OutputPath -Append -Encoding UTF8
"| Kategoria | Fajlok | Sorok | Meret KB |" | Out-File $OutputPath -Append -Encoding UTF8
"|---|---:|---:|---:|" | Out-File $OutputPath -Append -Encoding UTF8
$DisplayCategories = @("TypeScript", "JavaScript", "Dokumentacio", "Egyeb")
if ($ExportMode -eq "test") {
    $DisplayCategories = @("Teszt")
}

foreach ($category in ($DisplayCategories + @("Osszesen"))) {
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
foreach ($category in $DisplayCategories) {
    Write-StatRow $category ($totals[$category]).Files ($totals[$category]).Lines ($totals[$category]).Bytes
}
Write-Host "------------------------------------------------------------" -ForegroundColor DarkGray
Write-StatRow "Osszesen" $totals.Osszesen.Files $totals.Osszesen.Lines $totals.Osszesen.Bytes
Write-Separator