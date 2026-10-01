Add-Type -AssemblyName System.Drawing

$base = Split-Path -Parent $PSScriptRoot
$src = Join-Path $base "public\FOTOS"
$dst = Join-Path $base "public\img"

$map = [ordered]@{
  'MANU1524.JPG.jpeg' = 'bolsa-rose-1.jpg'
  'MANU1528.JPG.jpeg' = 'bolsa-rose-2.jpg'
  'MANU1533.JPG.jpeg' = 'bolsa-rose-3.jpg'
  'MANU1624.JPG.jpeg' = 'bolsa-rose-4.jpg'
  'MANU1625.JPG.jpeg' = 'bolsa-rose-5.jpg'
  'MANU1538.JPG.jpeg' = 'bolsa-noite.jpg'
  'MANU1546.JPG.jpeg' = 'bolsa-turquesa.jpg'
  'MANU1560.JPG.jpeg' = 'bolsa-terracota-leque.jpg'
  'MANU1592.JPG.jpeg' = 'bolsa-prata.jpg'
}

$enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]82)

foreach ($k in $map.Keys) {
  $in = Join-Path $src $k
  if (!(Test-Path $in)) { Write-Output "FALTA: $k"; continue }
  $im = [System.Drawing.Image]::FromFile($in)
  $w = $im.Width; $h = $im.Height
  $tw = [math]::Min($w, [int]($h * 0.8)); $th = [math]::Min($h, [int]($w / 0.8))
  $x = [int](($w - $tw) / 2); $y = [int](($h - $th) / 2)
  $bmp = New-Object System.Drawing.Bitmap(1280, 1600)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.DrawImage($im, (New-Object System.Drawing.Rectangle(0, 0, 1280, 1600)), $x, $y, $tw, $th, 'Pixel')
  $out = Join-Path $dst $map[$k]
  $bmp.Save($out, $enc, $ep)
  $g.Dispose(); $bmp.Dispose(); $im.Dispose()
  $kb = [int]((Get-Item $out).Length / 1KB)
  Write-Output "$k -> $($map[$k]) ($kb KB)"
}
