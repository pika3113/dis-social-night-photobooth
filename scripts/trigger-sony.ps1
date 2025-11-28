param([string]$Title = "Remote")

$wshell = New-Object -ComObject WScript.Shell
$success = $wshell.AppActivate($Title)

if ($success) {
    Start-Sleep -Milliseconds 200
    # Send '1' which triggers the shutter in Sony Remote
    $wshell.SendKeys("1")
    Write-Host "✅ Sent '1' to '$Title' window."
} else {
    Write-Host "❌ Could not find window with title containing '$Title'."
    Write-Host "   Make sure Sony Imaging Edge 'Remote' is open."
    exit 1
}
