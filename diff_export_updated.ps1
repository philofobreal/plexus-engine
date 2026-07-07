<#
.SYNOPSIS
diff_export.ps1

.DESCRIPTION
Rövid leírás:
Ez a script egy Markdown fájlba exportálja az aktuális branch
PR diff-jét és az érintett fájlok aktuális tartalmát a megadott base branch-hez képest.
Indításkor választót jelenít meg, amellyel szűrhető, milyen fájltípusokat gyűjtsön össze.

Alapértelmezésként a Windows biztonsági okokból blokkolhatja a .ps1 scriptek futtatását.
Ahhoz, hogy futtatni tudd ezt a fájlt, nyiss egy PowerShell ablakot rendszergazdaként (Run as Administrator), és futtasd ezt a parancsot:
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
#>

param (
    [string]$BaseBranch = "main"
)

$OutFile = "branch_pr_snapshot.md"

function Show-CollectionModeMenu {
    Write-Host ""
    Write-Host "Mit gyűjtsön össze a script?" -ForegroundColor Cyan
    Write-Host "1) Csak fejlesztői fájlokat (ts, js, json; teszt fájlok nélkül)"
    Write-Host "2) Csak teszt fájlokat (mjs, vite/vitest, spec/test fájlok)"
    Write-Host "3) Csak dokumentumokat (md, txt)"
    Write-Host "4) Mindent"
    Write-Host ""

    do {
        $choice = Read-Host "Válassz egy opciót [1-4]"
    } while ($choice -notin @("1", "2", "3", "4"))

    switch ($choice) {
        "1" { return "dev" }
        "2" { return "test" }
        "3" { return "docs" }
        "4" { return "all" }
    }
}

function Test-IsTestFile {
    param ([string]$Path)

    $normalized = $Path -replace "\\", "/"
    $fileName = [System.IO.Path]::GetFileName($normalized).ToLowerInvariant()
    $lowerPath = $normalized.ToLowerInvariant()

    return (
        $fileName -match "\.(spec|test)\.(ts|tsx|js|jsx|mjs|cjs)$" -or
        $fileName -match "^(vite|vitest)\.config\.(ts|js|mjs|cjs)$" -or
        $fileName -match "^vitest\.setup\.(ts|js|mjs|cjs)$" -or
        $lowerPath -match "(^|/)(__tests__|tests?|test-utils)(/|$)" -or
        $fileName.EndsWith(".mjs")
    )
}

function Test-ShouldIncludeFile {
    param (
        [string]$Path,
        [string]$Mode
    )

    if ([string]::IsNullOrWhiteSpace($Path)) { return $false }
    if ($Path -eq $OutFile) { return $false }

    $extension = [System.IO.Path]::GetExtension($Path).ToLowerInvariant()
    $isTestFile = Test-IsTestFile -Path $Path

    switch ($Mode) {
        "dev" {
            return (@(".ts", ".js", ".json") -contains $extension) -and -not $isTestFile
        }
        "test" {
            return $isTestFile
        }
        "docs" {
            return @(".md", ".txt") -contains $extension
        }
        "all" {
            return $true
        }
        default {
            return $true
        }
    }
}

function Get-ModeLabel {
    param ([string]$Mode)

    switch ($Mode) {
        "dev" { return "Csak fejlesztői fájlok" }
        "test" { return "Csak teszt fájlok" }
        "docs" { return "Csak dokumentumok" }
        "all" { return "Minden fájl" }
        default { return "Minden fájl" }
    }
}

# 1. Megkeressük a Git repó gyökerét
$GitRoot = git rev-parse --show-toplevel 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Hiba: Nem egy Git repository-ban vagy!" -ForegroundColor Red
    exit 1
}

# Munkakönyvtár beállítása a Git gyökérre
Push-Location $GitRoot

try {
    $CollectionMode = Show-CollectionModeMenu
    $CollectionModeLabel = Get-ModeLabel -Mode $CollectionMode

    $CurrentBranch = git branch --show-current

    # Fetch origin
    Write-Host "Adatok frissítése: git fetch origin $BaseBranch..." -ForegroundColor Cyan
    git fetch origin $BaseBranch 2>$null

    # Base Ref ellenőrzése
    $BaseRef = ""
    git rev-parse --verify "origin/$BaseBranch" 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
        $BaseRef = "origin/$BaseBranch"
    } else {
        git rev-parse --verify $BaseBranch 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) {
            $BaseRef = $BaseBranch
        } else {
            Write-Host "Hiba: nem található base branch: $BaseBranch" -ForegroundColor Red
            exit 1
        }
    }

    $MergeBase = git merge-base $BaseRef HEAD

    # Érintett fájlok listájának egyesítése és szűrése
    $trackedFiles = @(git diff --name-only $MergeBase)
    $untrackedFiles = @(git ls-files --others --exclude-standard)

    $filteredTrackedFiles = @($trackedFiles | Where-Object { Test-ShouldIncludeFile -Path $_ -Mode $CollectionMode })
    $filteredUntrackedFiles = @($untrackedFiles | Where-Object { Test-ShouldIncludeFile -Path $_ -Mode $CollectionMode })
    $allFiles = @($filteredTrackedFiles) + @($filteredUntrackedFiles) | Where-Object { $_ -ne "" } | Sort-Object -Unique

    $sb = New-Object System.Text.StringBuilder

    $DateStr = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

    [void]$sb.AppendLine("# PR snapshot")
    [void]$sb.AppendLine()
    [void]$sb.AppendLine("- Current branch: ``$CurrentBranch``")
    [void]$sb.AppendLine("- Base branch: ``$BaseRef``")
    [void]$sb.AppendLine("- Merge base: ``$MergeBase``")
    [void]$sb.AppendLine("- Collection mode: ``$CollectionModeLabel``")
    [void]$sb.AppendLine("- Generated: ``$DateStr``")
    [void]$sb.AppendLine()

    [void]$sb.AppendLine("## Teljes PR diff")
    [void]$sb.AppendLine()
    [void]$sb.AppendLine('```diff')

    # Commitolt + staged + unstaged tracked változások, a kiválasztott fájltípusokra szűrve
    if ($filteredTrackedFiles.Count -gt 0) {
        $diffOutput = git diff $MergeBase -- $filteredTrackedFiles
        if ($diffOutput) { [void]$sb.AppendLine(($diffOutput -join "`n")) }
    }

    # Untracked fájlok diffként, a kiválasztott fájltípusokra szűrve
    foreach ($file in $filteredUntrackedFiles) {
        $untrackedDiff = git diff --no-index -- /dev/null $file 2>$null
        if ($untrackedDiff) { [void]$sb.AppendLine(($untrackedDiff -join "`n")) }
    }

    [void]$sb.AppendLine('```')
    [void]$sb.AppendLine()

    [void]$sb.AppendLine("## Érintett fájlok teljes aktuális tartalma")
    [void]$sb.AppendLine()

    if ($allFiles.Count -eq 0) {
        [void]$sb.AppendLine("_Nincs a kiválasztott szűrésnek megfelelő érintett fájl._")
        [void]$sb.AppendLine()
    }

    foreach ($file in $allFiles) {
        [void]$sb.AppendLine("### ``$file``")
        [void]$sb.AppendLine()

        if (Test-Path -LiteralPath $file -PathType Leaf) {
            [void]$sb.AppendLine('```')
            $content = Get-Content -LiteralPath $file -Raw -ErrorAction SilentlyContinue
            if ($null -ne $content) {
                [void]$sb.AppendLine($content.TrimEnd())
            }
            [void]$sb.AppendLine('```')
        } else {
            [void]$sb.AppendLine("_A fájl törölve lett, ezért nincs aktuális tartalma._")
        }
        [void]$sb.AppendLine()
    }

    # Fájl kiírása tiszta (BOM nélküli) UTF-8 formátumban
    $OutFilePath = Join-Path (Get-Location) $OutFile
    [System.IO.File]::WriteAllText($OutFilePath, $sb.ToString(), [System.Text.Encoding]::UTF8)

    Write-Host "Kész: $OutFile ($CollectionModeLabel)" -ForegroundColor Green

} finally {
    Pop-Location
}
