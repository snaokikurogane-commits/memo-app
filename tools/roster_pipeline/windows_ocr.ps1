param(
  [Parameter(Mandatory = $true)]
  [string]$ImagePath
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]

function Await-WinRt {
  param(
    [Parameter(Mandatory = $true)]$Operation,
    [Parameter(Mandatory = $true)][Type]$ResultType
  )

  $method = [System.WindowsRuntimeSystemExtensions].GetMethods() |
    Where-Object {
      $_.Name -eq 'AsTask' -and
      $_.IsGenericMethod -and
      $_.GetParameters().Count -eq 1
    } |
    Select-Object -First 1

  $task = $method.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
  $task.Wait()
  return $task.Result
}

$resolvedPath = (Resolve-Path -LiteralPath $ImagePath).Path
$file = Await-WinRt ([Windows.Storage.StorageFile]::GetFileFromPathAsync($resolvedPath)) ([Windows.Storage.StorageFile])
$stream = Await-WinRt ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$decoder = Await-WinRt ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$bitmap = Await-WinRt ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()

if ($null -eq $engine) {
  throw 'Windows OCR engine is unavailable. Install the Japanese OCR language capability.'
}

$result = Await-WinRt ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
$words = @()

foreach ($line in $result.Lines) {
  foreach ($word in $line.Words) {
    $rect = $word.BoundingRect
    $words += [pscustomobject]@{
      text = [string]$word.Text
      x = [double]$rect.X
      y = [double]$rect.Y
      width = [double]$rect.Width
      height = [double]$rect.Height
    }
  }
}

[pscustomobject]@{
  language = [string]$engine.RecognizerLanguage.LanguageTag
  width = [int]$bitmap.PixelWidth
  height = [int]$bitmap.PixelHeight
  text = [string]$result.Text
  words = $words
} | ConvertTo-Json -Depth 5 -Compress
