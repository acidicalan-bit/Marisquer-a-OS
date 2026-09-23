$ErrorActionPreference = "Stop"

$config = @{}
$environmentFile = Join-Path $PSScriptRoot "..\.env.local"
if (Test-Path -LiteralPath $environmentFile) {
  foreach ($line in Get-Content -LiteralPath $environmentFile) {
    if ($line -match "^([A-Za-z_][A-Za-z0-9_]*)=(.*)$") {
      $config[$Matches[1]] = $Matches[2].Trim().Trim('"')
    }
  }
}

if (-not $config.SUPABASE_SECRET_KEY) {
  $config.SUPABASE_SECRET_KEY = Read-Host "Pega la Secret API Key del proyecto Supabase Barlovento"
}
if (-not $config.SUPABASE_SECRET_KEY) {
  throw "Se requiere la llave privada de Supabase para operar."
}
if (-not $config.OPENAI_API_KEY) {
  $openAiKey = Read-Host "OpenAI API Key (opcional; Enter usa respuestas locales)"
  if ($openAiKey) { $config.OPENAI_API_KEY = $openAiKey }
}

$runtime = @{
  SUPABASE_SECRET_KEY = $config.SUPABASE_SECRET_KEY
  OPENAI_API_KEY = $config.OPENAI_API_KEY
  OPENAI_ASSISTANT_MODEL = if ($config.OPENAI_ASSISTANT_MODEL) { $config.OPENAI_ASSISTANT_MODEL } else { "gpt-4.1-mini" }
  OPENAI_IMAGE_MODEL = if ($config.OPENAI_IMAGE_MODEL) { $config.OPENAI_IMAGE_MODEL } else { "gpt-image-1" }
}

$runtimeDirectory = Join-Path $env:APPDATA "Barlovento\Admin"
New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null
$runtimePath = Join-Path $runtimeDirectory "server-config.json"
$runtime | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath $runtimePath -Encoding utf8

$identity = "$($env:USERDOMAIN)\$($env:USERNAME)"
& icacls $runtimeDirectory /inheritance:r /grant:r "${identity}:(OI)(CI)F" "SYSTEM:(OI)(CI)F" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "No se pudieron limitar los permisos de la carpeta privada." }
& icacls $runtimePath /inheritance:r /grant:r "${identity}:F" "SYSTEM:F" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "No se pudieron limitar los permisos de la configuración." }

Write-Output "Configuración privada de Barlovento lista para este usuario de Windows."
Write-Output "Cierra y vuelve a abrir Barlovento para cargarla."
