# Desktop Pet 설치 스크립트 (Windows)

$ErrorActionPreference = "Stop"

$repo = "kangjunlee/desktop-pet"
$asset = "Desktop.Pet_0.1.0_x64-setup.exe"

Write-Host "🐾 Desktop Pet 설치 중..." -ForegroundColor Cyan

# 다운로드
Write-Host "⬇️  다운로드 중..."
$downloadPath = "$env:TEMP\DesktopPet-setup.exe"
Invoke-WebRequest -Uri "https://github.com/$repo/releases/latest/download/$asset" -OutFile $downloadPath

# 설치 실행
Write-Host "📦 설치 중..."
Start-Process -FilePath $downloadPath -Wait

# 정리
Remove-Item $downloadPath -Force

Write-Host "✅ 설치 완료!" -ForegroundColor Green
Write-Host "🚀 시작 메뉴에서 'Desktop Pet'을 검색하여 실행하세요."
