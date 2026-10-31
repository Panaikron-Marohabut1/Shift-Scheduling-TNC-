$ErrorActionPreference = 'Stop'
$shiftRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$shiftLocal = [IO.Path]::GetFullPath((Join-Path $shiftRoot '.local'))
$shiftArchive = Join-Path $shiftLocal 'postgresql.zip'
$shiftPartial = Join-Path $shiftLocal 'postgresql.zip.partial'
New-Item -ItemType Directory -Force -Path $shiftLocal | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Test-PostgresArchive([string]$ArchivePath) {
  $archive = $null
  try {
    $archive = [IO.Compression.ZipFile]::OpenRead($ArchivePath)
    foreach ($binary in @('postgres.exe', 'pg_ctl.exe', 'initdb.exe', 'psql.exe', 'createdb.exe')) {
      if ($null -eq $archive.GetEntry("pgsql/bin/$binary")) { return $false }
    }
    return $true
  } catch {
    return $false
  } finally {
    if ($null -ne $archive) { $archive.Dispose() }
  }
}

if ((Test-Path -LiteralPath $shiftArchive) -and -not (Test-PostgresArchive $shiftArchive)) {
  Write-Host 'Cached PostgreSQL ZIP is incomplete or invalid. Downloading it again.'
  Remove-Item -LiteralPath $shiftArchive
}
if (-not (Test-Path -LiteralPath $shiftArchive)) {
  # Official EDB Windows x64 portable distribution linked by PostgreSQL.org.
  try {
    if (Test-Path -LiteralPath $shiftPartial) { Remove-Item -LiteralPath $shiftPartial }
    Invoke-WebRequest -Uri 'https://sbp.enterprisedb.com/getfile.jsp?fileid=1260609' -OutFile $shiftPartial -UseBasicParsing
    if (-not (Test-PostgresArchive $shiftPartial)) {
      throw 'The PostgreSQL download is incomplete or is not the expected binaries ZIP. Run pnpm setup again to retry.'
    }
    Move-Item -LiteralPath $shiftPartial -Destination $shiftArchive
  } finally {
    if (Test-Path -LiteralPath $shiftPartial) { Remove-Item -LiteralPath $shiftPartial }
  }
}
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
