# Prepare the plugin repo's node_modules junctions so .test/smoke.mjs can
# import the plugin against a local deepseek-harness checkout.
# usage: pwsh .test/setup.ps1            (set DSH_HARNESS_ROOT to point elsewhere)
$root = if ($env:DSH_HARNESS_ROOT) { $env:DSH_HARNESS_ROOT } else { 'D:\Programs\.RunOnSource\deepseek-harness' }
$nm = Join-Path $PSScriptRoot '..\node_modules\@deepseek-ai'
New-Item -ItemType Directory -Path $nm -Force | Out-Null
$targets = @{
  'cordis'          = Join-Path $root 'vendor\cordis'
  'schemastery'     = Join-Path $root 'vendor\schemastery'
  'dsh-settings'    = Join-Path $root 'packages\settings\settings'
  'dsh-system-prompt' = Join-Path $root 'packages\core\system-prompt'
  'dsh-scope'       = Join-Path $root 'packages\core\scope'
  'dsh-util-values' = Join-Path $root 'packages\util\values'
}
foreach ($key in $targets.Keys) {
  $link = Join-Path $nm $key
  if (Test-Path $link) { Remove-Item $link -Force -Recurse }
  if (-not (Test-Path $targets[$key])) { Write-Error "harness path missing: $($targets[$key])"; exit 1 }
  New-Item -ItemType Junction -Path $link -Target $targets[$key] | Out-Null
}
Write-Output "junctions ready under $nm"
