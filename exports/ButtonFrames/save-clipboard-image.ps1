param([Parameter(Mandatory=$true)][string]$OutputPath)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$taskImage = [System.Windows.Forms.Clipboard]::GetImage()
if ($null -eq $taskImage) { throw 'Clipboard contains no image' }
$taskImage.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
[PSCustomObject]@{Width=$taskImage.Width;Height=$taskImage.Height;Path=$OutputPath} | ConvertTo-Json -Compress
$taskImage.Dispose()
