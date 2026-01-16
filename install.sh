#!/bin/bash
# Desktop Pet 설치 스크립트

set -e

REPO="kangjunlee/desktop-pet"
APP_NAME="Desktop Pet"

echo "🐾 Desktop Pet 설치 중..."

# OS 감지
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
    Darwin)
        echo "📱 macOS 감지됨 ($ARCH)"

        if [ "$ARCH" = "arm64" ]; then
            ASSET="Desktop.Pet_0.1.0_aarch64.dmg"
        else
            ASSET="Desktop.Pet_0.1.0_x64.dmg"
        fi

        # 다운로드
        echo "⬇️  다운로드 중..."
        curl -L -o /tmp/DesktopPet.dmg "https://github.com/$REPO/releases/latest/download/$ASSET"

        # 마운트 및 설치
        echo "📦 설치 중..."
        hdiutil attach /tmp/DesktopPet.dmg -quiet
        cp -R "/Volumes/$APP_NAME/$APP_NAME.app" /Applications/
        hdiutil detach "/Volumes/$APP_NAME" -quiet
        rm /tmp/DesktopPet.dmg

        echo "✅ 설치 완료! Applications 폴더에서 '$APP_NAME'을 실행하세요."
        echo "🚀 지금 바로 실행하려면: open '/Applications/$APP_NAME.app'"
        ;;

    MINGW*|MSYS*|CYGWIN*)
        echo "🪟 Windows 감지됨"
        echo "PowerShell에서 다음 명령어를 실행하세요:"
        echo ""
        echo "  irm https://raw.githubusercontent.com/$REPO/main/install.ps1 | iex"
        ;;

    *)
        echo "❌ 지원하지 않는 OS입니다: $OS"
        exit 1
        ;;
esac
