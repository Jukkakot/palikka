param(
  [Parameter(Mandatory)] [string] $Method,
  [Parameter(Mandatory)] [string] $Path,
  [string] $BodyFile
)
# Calls the Axiom REST API with the user's personal token, read from the user environment (never printed).
$pat = [Environment]::GetEnvironmentVariable("AXIOM_PAT", "User")
$org = [Environment]::GetEnvironmentVariable("AXIOM_ORG_ID", "User")
$headers = @{ Authorization = "Bearer $pat"; "X-AXIOM-ORG-ID" = $org }
$args = @{ Method = $Method; Uri = "https://api.axiom.co$Path"; Headers = $headers; ContentType = "application/json" }
if ($BodyFile) { $args.Body = [System.IO.File]::ReadAllText($BodyFile) }
try {
  $r = Invoke-RestMethod @args
  $r | ConvertTo-Json -Depth 20
} catch {
  "ERROR $($_.Exception.Response.StatusCode.value__): $($_.ErrorDetails.Message)"
}
