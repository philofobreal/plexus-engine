<#
.SYNOPSIS
diff_export.ps1

.DESCRIPTION
Rövid leírás:
Ez a script egy Markdown fájlba exportálja az aktuális branch
teljes PR diff-jét a megadott base branch-hez képest.
Alapértelmezésként a Windows biztonsági okokból blokkolhatja a .ps1 scriptek futtatását. 
Ahhoz, hogy futtatni tudd ezt a fájlt, nyiss egy PowerShell ablakot rendszergazdaként (Run as Administrator), és futtasd ezt a parancsot:
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
#>

param (
    [string]$BaseBranch = "main"
)

$OutFile = "branch_pr_snapshot.md"

# 1. Megkeressük a Git repó gyökerét
$GitRoot = git rev-parse --show-toplevel 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Hiba: Nem egy Git repository-ban vagy!" -ForegroundColor Red
    exit 1
}

# Munkakönyvtár beállítása a Git gyökérre
Push-Location $GitRoot

try {
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

    $sb = New-Object System.Text.StringBuilder

    $DateStr = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

    [void]$sb.AppendLine("# PR snapshot")
    [void]$sb.AppendLine()
    
    # JAVÍTVA: Dupla backtick (``) a Markdown formázáshoz
    [void]$sb.AppendLine("- Current branch: ``$CurrentBranch``")
    [void]$sb.AppendLine("- Base branch: ``$BaseRef``")
    [void]$sb.AppendLine("- Merge base: ``$MergeBase``")
    [void]$sb.AppendLine("- Generated: ``$DateStr``")
    [void]$sb.AppendLine()

    [void]$sb.AppendLine("## Teljes PR diff")
    [void]$sb.AppendLine()
    [void]$sb.AppendLine('```diff')

    # Commitolt + staged + unstaged tracked változások
    $diffOutput = git diff $MergeBase
    if ($diffOutput) { [void]$sb.AppendLine(($diffOutput -join "`n")) }

    # Untracked fájlok diffként
    $untrackedFiles = git ls-files --others --exclude-standard
    foreach ($file in $untrackedFiles) {
        if ($file -eq $OutFile) { continue }
        
        $untrackedDiff = git diff --no-index -- /dev/null $file 2>$null
        if ($untrackedDiff) { [void]$sb.AppendLine(($untrackedDiff -join "`n")) }
    }

    [void]$sb.AppendLine('```')
    [void]$sb.AppendLine()

    [void]$sb.AppendLine("## Érintett fájlok teljes aktuális tartalma")
    [void]$sb.AppendLine()

    # Érintett fájlok listájának egyesítése
    $trackedFiles = git diff --name-only $MergeBase
    $allFiles = @($trackedFiles) + @($untrackedFiles) | Where-Object { $_ -ne "" } | Sort-Object -Unique

    foreach ($file in $allFiles) {
        if ($file -eq $OutFile) { continue }

        # JAVÍTVA: Dupla backtick (``)
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

    Write-Host "Kész: $OutFile" -ForegroundColor Green

} finally {
    Pop-Location
}