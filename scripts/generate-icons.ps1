param(
    [string]$SourcePath = (Join-Path $PSScriptRoot '../content/brand/deafnavi-icon.png')
)

# Export the supplied artwork at web icon sizes without redrawing it.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$assetDir = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../src/assets'))
$iconDir = Join-Path $assetDir 'icons'
[IO.Directory]::CreateDirectory($iconDir) | Out-Null
$source = [Drawing.Image]::FromFile((Resolve-Path -LiteralPath $SourcePath).Path)

function Export-Icon([int]$Size, [string]$Name, [double]$Scale = 1, [bool]$Opaque = $false) {
    $bitmap = [Drawing.Bitmap]::new($Size, $Size, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    $attributes = [Drawing.Imaging.ImageAttributes]::new()
    try {
        if ($Opaque) { $graphics.Clear([Drawing.Color]::White) }
        else { $graphics.Clear([Drawing.Color]::Transparent) }
        $graphics.CompositingQuality = [Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $attributes.SetWrapMode([Drawing.Drawing2D.WrapMode]::TileFlipXY)
        $edge = [int][Math]::Round($Size * $Scale)
        $offset = [int][Math]::Floor(($Size - $edge) / 2)
        $rect = [Drawing.Rectangle]::new($offset, $offset, $edge, $edge)
        $graphics.DrawImage($source, $rect, 0, 0, $source.Width, $source.Height, [Drawing.GraphicsUnit]::Pixel, $attributes)
        $bitmap.Save((Join-Path $iconDir $Name), [Drawing.Imaging.ImageFormat]::Png)
    } finally {
        $attributes.Dispose()
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}

try {
    if ($source.Width -ne $source.Height) { throw 'The source icon must be square.' }
    foreach ($size in @(16, 32, 48)) { Export-Icon $size "favicon-$size.png" }
    Export-Icon 192 'icon-192.png'
    Export-Icon 512 'icon-512.png'
    Export-Icon 180 'apple-touch-icon.png' 1 $true
    # The text-free mark sits within the central safe circle; keep its blue background full bleed.
    Export-Icon 512 'icon-maskable-512.png' 1 $true

    # Retain the old SVG URL for bookmarks and cached page markup.
    $base64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $iconDir 'icon-192.png')))
    $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><image width="192" height="192" href="data:image/png;base64,' + $base64 + '"/></svg>'
    [IO.File]::WriteAllText((Join-Path $assetDir 'favicon.svg'), $svg + "`n", [Text.UTF8Encoding]::new($false))

    # Multi-size ICO with PNG frames, supported by current desktop browsers.
    $sizes = @(16, 32, 48)
    $frames = @($sizes | ForEach-Object { ,([IO.File]::ReadAllBytes((Join-Path $iconDir "favicon-$_.png"))) })
    $stream = [IO.File]::Create((Join-Path $assetDir 'favicon.ico'))
    $writer = [IO.BinaryWriter]::new($stream)
    try {
        $writer.Write([uint16]0)
        $writer.Write([uint16]1)
        $writer.Write([uint16]$sizes.Count)
        $offset = 6 + (16 * $sizes.Count)
        for ($i = 0; $i -lt $sizes.Count; $i++) {
            $writer.Write([byte]$sizes[$i])
            $writer.Write([byte]$sizes[$i])
            $writer.Write([byte]0)
            $writer.Write([byte]0)
            $writer.Write([uint16]1)
            $writer.Write([uint16]32)
            $writer.Write([uint32]$frames[$i].Length)
            $writer.Write([uint32]$offset)
            $offset += $frames[$i].Length
        }
        foreach ($frame in $frames) { $writer.Write([byte[]]$frame) }
    } finally { $writer.Dispose() }
} finally { $source.Dispose() }

Get-ChildItem -LiteralPath $iconDir | Select-Object Name, Length
