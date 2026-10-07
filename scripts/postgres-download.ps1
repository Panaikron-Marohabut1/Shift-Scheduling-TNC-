$ErrorActionPreference = 'Stop'
$shiftRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$shiftLocal = [IO.Path]::GetFullPath((Join-Path $shiftRoot '.local'))
$shiftArchive = Join-Path $shiftLocal 'postgresql.zip'
New-Item -ItemType Directory -Force -Path $shiftLocal | Out-Null
if (-not (Test-Path -LiteralPath $shiftArchive)) {
  # Official EDB Windows x64 portable distribution linked by PostgreSQL.org.
  Invoke-WebRequest -Uri 'https://sbp.enterprisedb.com/getfile.jsp?fileid=1260609' -OutFile $shiftArchive -UseBasicParsing
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$shiftZip = [IO.Compression.ZipFile]::OpenRead($shiftArchive)
try {
  foreach ($shiftEntry in $shiftZip.Entries) {
    if ($shiftEntry.FullName -notmatch '^pgsql/(bin|lib|share)/' -or $shiftEntry.FullName.EndsWith('/')) { continue }
    $shiftTarget = [IO.Path]::GetFullPath((Join-Path $shiftLocal $shiftEntry.FullName))
    if (-not $shiftTarget.StartsWith($shiftLocal + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Archive path escaped local directory' }
    [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($shiftTarget)) | Out-Null
    [IO.Compression.ZipFileExtensions]::ExtractToFile($shiftEntry, $shiftTarget, $true)
  }
} finally { $shiftZip.Dispose() }
