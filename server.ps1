param(
  [int]$port = 3000
)

$ErrorActionPreference = "Stop"
$node = "C:\Users\forGUSE\AppData\Local\OpenAI\Codex\bin\5b9024f90663758b\node.exe"
$next = Join-Path $PSScriptRoot "node_modules\next\dist\bin\next"

Set-Location $PSScriptRoot
& $node $next dev -p $port
