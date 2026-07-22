#!/bin/sh
set -e

# ============================================================
# MHTools Installer
# 轻量级安装入口：依赖由 apk/opkg 自动补齐，mihomo 外置
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

# --- 基础系统依赖：只做轻量化、OpenWrt 25.12.1 可用包聚合 ---
if [ ! -e /dev/net/tun ]; then
	warn "TUN kernel module not found. Installing required runtime dependencies..."
	if command -v apk >/dev/null 2>&1; then
		apk update
		apk add --no-cache kmod-tun nftables python3-yaml ca-certificates wget-ssl curl
		modprobe tun 2>/dev/null || true
	elif command -v opkg >/dev/null 2>&1; then
		opkg update
		opkg install kmod-tun nftables python3-yaml ca-certificates wget curl
	else
		error "Cannot install runtime dependencies: neither apk nor opkg found."
		exit 1
	fi
else
	info "TUN kernel module already loaded."
fi

# --- mihomo 内核（获取策略：复用 > 镜像下载 > 手动兜底）---
# 说明：本项目只做 LuCI 管理层；mihomo 内核保持外置，不打包到安装文件中。
MIHOMO_BIN="/usr/bin/mihomo"
MIHOMO_VER="${MIHOMO_VER:-v1.19.29}"
MIHOMO_CHANNEL="${MIHOMO_CHANNEL:-stable}"

# 1) 复用：已存在 /usr/bin/mihomo 直接复用；否则把 PATH 中的
#    clash-meta / mihomo 软链到 /usr/bin/mihomo（服务默认读这个路径）
if [ -x "$MIHOMO_BIN" ]; then
	info "Reusing existing mihomo: $MIHOMO_BIN"
	"$MIHOMO_BIN" version 2>&1 | head -1
elif META_BIN=$(command -v clash-meta 2>/dev/null) && [ -n "$META_BIN" ]; then
	ln -sf "$META_BIN" "$MIHOMO_BIN"
	info "Linked existing clash-meta ($META_BIN) -> $MIHOMO_BIN"
elif MH_BIN=$(command -v mihomo 2>/dev/null) && [ -n "$MH_BIN" ]; then
	ln -sf "$MH_BIN" "$MIHOMO_BIN"
	info "Linked existing mihomo ($MH_BIN) -> $MIHOMO_BIN"
else
	# 2) 下载：依次尝试官方源与多个 GitHub 代理镜像。
	#    解决"刚刷好的路由还没有代理、却要从 GitHub 下载代理内核"的矛盾。
	ARCH=$(uname -m)
	case "$ARCH" in
		aarch64|arm64)    MIHOMO_ARCH="linux-arm64" ;;
		x86_64|amd64)     MIHOMO_ARCH="linux-amd64" ;;
		armv7l|armv7)     MIHOMO_ARCH="linux-armv7" ;;
		mips64*)          MIHOMO_ARCH="linux-mips64" ;;
		mips*)            MIHOMO_ARCH="linux-mips-softfloat" ;;
		*) error "Unknown architecture: $ARCH"; exit 1 ;;
	esac

	REL="MetaCubeX/mihomo/releases/download/${MIHOMO_VER}/mihomo-${MIHOMO_ARCH}-${MIHOMO_VER}.gz"
	MIRRORS="
https://github.com/${REL}
https://ghproxy.net/https://github.com/${REL}
https://mirror.ghproxy.com/https://github.com/${REL}
"
	if [ "$MIHOMO_CHANNEL" = "alpha" ] || printf '%s' "$MIHOMO_VER" | grep -qi 'alpha'; then
		warn "Alpha channel requested. Download URL will use the provided MIHOMO_VER value directly."
	fi
	DOWNLOADED=""
	for url in $MIRRORS; do
		info "Trying mirror: $url"
		if command -v wget >/dev/null 2>&1; then
			wget -O /tmp/mihomo.gz "$url" 2>/dev/null && DOWNLOADED=1 && break
		elif command -v curl >/dev/null 2>&1; then
			curl -sL "$url" -o /tmp/mihomo.gz 2>/dev/null && DOWNLOADED=1 && break
		fi
	done

	if [ -n "$DOWNLOADED" ] && [ -s /tmp/mihomo.gz ]; then
		gunzip -f /tmp/mihomo.gz
		mv /tmp/mihomo "$MIHOMO_BIN"
		chmod +x "$MIHOMO_BIN"
		info "mihomo ${MIHOMO_VER} installed to $MIHOMO_BIN"
	else
		# 3) 手动兜底：不阻断 LuCI 安装，提示用户稍后放置内核
		warn "Could not download mihomo automatically (no network / all mirrors failed)."
		warn "The LuCI app will still be installed, but the service won't start"
		warn "until a mihomo binary exists at $MIHOMO_BIN."
		warn "Fix manually:"
		warn "  - place the binary at $MIHOMO_BIN, or"
		warn "  - opkg install mihomo   (if available in your feed)"
	fi
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

# 安装清单：记录所有安装的文件，供 uninstall.sh 精确卸载
MANIFEST="/usr/share/mhtools/manifest"
mkdir -p "$(dirname "$MANIFEST")"
: > "$MANIFEST"
record() { echo "$1" >> "$MANIFEST"; }

# 拷贝 htdocs (LuCI 前端 JS/CSS) 并记录清单
if [ -d "$SRC_DIR/htdocs" ]; then
	( cd "$SRC_DIR/htdocs" && find . -type f -not -name '.DS_Store' ) | while read -r f; do
		f="${f#./}"
		tgt="/www/$f"
		mkdir -p "$(dirname "$tgt")"
		cp -a "$SRC_DIR/htdocs/$f" "$tgt"
		record "$tgt"
	done
	info "LuCI frontend installed."
fi

# 拷贝 root 下的系统文件 并记录清单
if [ -d "$SRC_DIR/root" ]; then
	for dir in etc usr; do
		if [ -d "$SRC_DIR/root/$dir" ]; then
			( cd "$SRC_DIR/root/$dir" && find . -type f -not -name '.DS_Store' ) | while read -r f; do
				f="${f#./}"
				tgt="/$dir/$f"
				mkdir -p "$(dirname "$tgt")"
				cp -a "$SRC_DIR/root/$dir/$f" "$tgt"
				record "$tgt"
			done
		fi
	done
	info "System files installed."
fi

# 记录清单自身，便于卸载时定位
record "$MANIFEST"

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
echo ""
echo " Manage:"
echo "   Upgrade (in-place): sh install.sh"
echo "   Clean reinstall:     sh uninstall.sh && sh install.sh"
echo "   Uninstall:           sh uninstall.sh"
echo "============================================"
