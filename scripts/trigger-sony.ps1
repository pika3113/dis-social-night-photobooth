$wshell = New-Object -ComObject WScript.Shell
# Attempt to focus the Remote window
$wshell.AppActivate("Remote")
Start-Sleep -Milliseconds 200

# Define C# class to access low-level keyboard events
$code = @"
using System;
using System.Runtime.InteropServices;
public class Keyboard {
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
    public const int KEYEVENTF_KEYUP = 0x0002;
    public const byte VK_1 = 0x31; // Virtual Key Code for '1'

    public static void PressOne() {
        keybd_event(VK_1, 0, 0, UIntPtr.Zero);
    }

    public static void ReleaseOne() {
        keybd_event(VK_1, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
    }
}
"@

Add-Type -TypeDefinition $code

# Press '1'
[Keyboard]::PressOne()
Write-Host "⬇️  Key '1' DOWN"

# Hold for 1 second
Start-Sleep -Seconds 1

# Release '1'
[Keyboard]::ReleaseOne()
Write-Host "⬆️  Key '1' UP"
