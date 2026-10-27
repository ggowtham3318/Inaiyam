$ErrorActionPreference = 'Stop'

$baseUrl = $env:SUPABASE_URL
$anonKey = $env:SUPABASE_ANON_KEY
$serviceKey = $env:SUPABASE_SERVICE_ROLE_KEY
if ([string]::IsNullOrWhiteSpace($baseUrl) -or [string]::IsNullOrWhiteSpace($anonKey) -or [string]::IsNullOrWhiteSpace($serviceKey)) {
  throw 'Set SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.'
}

$target = [Uri]$baseUrl
if ($target.Host -notin @('127.0.0.1', 'localhost', '::1') -or $env:RLS_TEST_ALLOW_LOCAL -ne 'true') {
  throw 'Refusing auth smoke tests outside an explicitly enabled local Supabase project.'
}

$run = [guid]::NewGuid().ToString('N')
$email = "auth-smoke-$run@example.invalid"
$password = "AuthSmoke@$([guid]::NewGuid().ToString('N'))aA1!"
$userId = $null
$failures = 0

function Check($name, $condition) {
  if ($condition) { Write-Output "PASS $name" }
  else { Write-Output "FAIL $name"; $script:failures++ }
}

function Invoke-Json($method, $uri, $headers, $body) {
  $parameters = @{ Method = $method; Uri = $uri; Headers = $headers; ErrorAction = 'Stop' }
  if ($null -ne $body) {
    $parameters.ContentType = 'application/json'
    $parameters.Body = $body | ConvertTo-Json -Depth 8
  }
  Invoke-RestMethod @parameters
}

try {
  $headers = @{ apikey = $anonKey }
  $signup = Invoke-Json 'Post' "$baseUrl/auth/v1/signup" $headers @{
    email = $email
    password = $password
    data = @{
      privacy_policy_accepted = $true
      terms_accepted = $true
      policy_version = 'v1'
    }
  }
  $userId = $signup.user.id
  if (-not $userId) { $userId = $signup.id }
  Check 'signup creates a user' (-not [string]::IsNullOrWhiteSpace($userId))
  Check 'local signup returns a session' (-not [string]::IsNullOrWhiteSpace($signup.access_token))

  $login = Invoke-Json 'Post' "$baseUrl/auth/v1/token?grant_type=password" $headers @{ email = $email; password = $password }
  Check 'new user can log in' (-not [string]::IsNullOrWhiteSpace($login.access_token))

  if ($userId -and $login.access_token) {
    $profileHeaders = @{
      apikey = $anonKey
      Authorization = "Bearer $($login.access_token)"
      'Accept-Profile' = 'app'
    }
    $profile = Invoke-Json 'Get' "$baseUrl/rest/v1/profiles?user_id=eq.$userId&select=status" $profileHeaders $null
    Check 'signup creates a draft profile' (@($profile).Count -eq 1 -and $profile[0].status -eq 'draft')

    $consent = Invoke-Json 'Get' "$baseUrl/rest/v1/consent_records?user_id=eq.$userId&select=consent_type,policy_version,granted" $profileHeaders $null
    Check 'signup records both v1 consents' (@($consent).Count -eq 2 -and @($consent | Where-Object { $_.policy_version -eq 'v1' -and $_.granted }).Count -eq 2)
  }
} catch {
  Write-Output "FAIL auth smoke request: $($_.Exception.Message)"
  $failures++
} finally {
  if ($userId) {
    $cleanupHeaders = @{ apikey = $anonKey; Authorization = "Bearer $serviceKey" }
    try {
      Invoke-RestMethod -Method Delete -Uri "$baseUrl/auth/v1/admin/users/$userId" -Headers $cleanupHeaders -ErrorAction Stop | Out-Null
      Write-Output 'PASS temporary user cleanup'
    } catch {
      Write-Output "FAIL temporary user cleanup for ${email}: $($_.Exception.Message)"
      $failures++
    }
  }
}

if ($failures -gt 0) { throw "Auth smoke tests failed: $failures failure(s)." }
Write-Output 'All auth smoke tests passed.'
