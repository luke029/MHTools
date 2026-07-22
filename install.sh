#!/bin/sh
set -e

# ============================================================
# MHTools Installer
# 一键安装：自动处理 kmod-tun、mihomo 内核等依赖
# ============================================================

RED='\033[31m'
GREEN='\033[32m'
YELLOW='\033[33m'
NC='\033[0m' # No Color

info()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; }

# 必须是 root
if [ "$(id -u)" != "0" ]; then
	error "This script must be run as root."
	exit 1
fi

# 检测 OpenWrt/ImmortalWrt
if ! grep -qE 'OpenWrt|ImmortalWrt' /etc/os-release 2>/dev/null; then
	warn "This does not appear to be an OpenWrt/ImmortalWrt system."
fi

MHTOOLS_VERSION=$(cat VERSION 2>/dev/null || echo "unknown")
info "MHTools v${MHTOOLS_VERSION} installer"
echo ""

# ============================================================
# Step 1: 依赖检测与安装
# ============================================================

# --- kmod-tun ---
if [ ! -e /dev/net/tun ]; then
	warn "TUN kernel module not found. Installing kmod-tun..."
	if command -v apk >/dev/null 2>&1; then
		apk add kmod-tun
		modprobe tun
	elif command -v opkg >/dev/null 2>&1; then
		opkg update
		opkg install kmod-tun
	else
		error "Cannot install kmod-tun: neither apk nor opkg found."
		exit 1
	fi
else
	info "TUN kernel module already loaded."
fi

# --- mihomo 内核 ---
MIHOMO_BIN="/usr/bin/mihomo"
MIHOMO_VER="v1.19.29"  # 当前推荐版本
if [ ! -x "$MIHOMO_BIN" ]; then
	warn "mihomo binary not found. Downloading..."

	ARCH=$(uname -m)
	case "$ARCH" in
		aarch64|arm64)    MIHOMO_ARCH="linux-arm64" ;;
		x86_64|amd64)     MIHOMO_ARCH="linux-amd64" ;;
		armv7l|armv7)     MIHOMO_ARCH="linux-armv7" ;;
		mips64*)          MIHOMO_ARCH="linux-mips64" ;;
		mips*)            MIHOMO_ARCH="linux-mips-softfloat" ;;
		*) error "Unknown architecture: $ARCH"; exit 1 ;;
	esac

	MIHOMO_URL="https://github.com/MetaCubeX/mihomo/releases/download/${MIHOMO_VER}/mihomo-${MIHOMO_ARCH}-${MIHOMO_VER}.gz"
	info "Downloading: $MIHOMO_URL"

	if command -v wget >/dev/null 2>&1; then
		wget -O /tmp/mihomo.gz "$MIHOMO_URL"
	elif command -v curl >/dev/null 2>&1; then
		curl -sL "$MIHOMO_URL" -o /tmp/mihomo.gz
	else
		error "Neither wget nor curl found. Cannot download mihomo."
		exit 1
	fi

	gunzip -f /tmp/mihomo.gz
	mv /tmp/mihomo "$MIHOMO_BIN"
	chmod +x "$MIHOMO_BIN"
	info "mihomo ${MIHOMO_VER} installed to $MIHOMO_BIN"
else
	info "mihomo binary found: $MIHOMO_BIN"
	$MIHOMO_BIN version 2>&1 | head -1
fi

# ============================================================
# Step 2: 安装 MHTools 文件
# ============================================================

SRC_DIR="luci-app-mhtools"
if [ ! -d "$SRC_DIR" ]; then
	error "Directory '$SRC_DIR' not found. Please run from extracted tarball root."
	exit 1
fi

info "Installing MHTools files..."

# 拷贝 htdocs (LuCI 前端 JS/CSS)
if [ -d "$SRC_DIR/htdocs" ]; then
	cp -a "$SRC_DIR/htdocs/"* /www/
	info "LuCI frontend installed."
fi

# 拷贝 root 下的系统文件
if [ -d "$SRC_DIR/root" ]; then
	for dir in etc usr; do
		if [ -d "$SRC_DIR/root/$dir" ]; then
			cp -a "$SRC_DIR/root/$dir"/* "/$dir/"
		fi
	done
	info "System files installed."
fi

# 创建设备目录
mkdir -p /etc/mhtools/profiles
mkdir -p /etc/mhtools/run/mihomo/proxies
mkdir -p /var/log/mhtools

# 权限
chmod 755 /etc/mhtools /etc/mhtools/profiles /etc/mhtools/run
chmod 755 /etc/config/mhtools 2>/dev/null || true

info "Directories and permissions set."

# ============================================================
# Step 3: 注册服务 & 清理缓存
# ============================================================

# 设置开机自启
if [ -x /etc/init.d/mhtools ]; then
	/etc/init.d/mhtools enable 2>/dev/null || true
	info "Service enabled for auto-start."
fi

# 重启 rpcd 以加载新 ACL/ucode
if [ -x /etc/init.d/rpcd ]; then
	/etc/init.d/rpcd restart 2>/dev/null || warn "rpcd restart failed (may need manual restart)"
	info "rpcd restarted."
fi

# 清除 LuCI 缓存
rm -f /tmp/luci-indexcache /tmp/luci-modulecache/* 2>/dev/null || true
info "LuCI cache cleared."

echo ""
echo "============================================"
echo -e " ${GREEN}MHTools v${MHTOOLS_VERSION} installed!${NC}"
echo ""
echo " Next steps:"
echo "   1. Open LuCI → Services → MHTools"
echo "   2. Upload your mihomo config (.yaml)"
echo "   3. Enable and start the service"
echo ""
echo " To check status:"
echo "   /etc/init.d/mhtools list_profiles"
echo "   /etc/init.d/mhtools validate_profile"
echo "============================================"
