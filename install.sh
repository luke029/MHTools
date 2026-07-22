#!/bin/sh
# MHTools LuCI 安装脚本
# 用法: 把整个项目 scp 到路由器，然后 sh install.sh
# scp -r install.sh luci-app-mhtools root@router:/tmp/
# ssh root@router "cd /tmp && sh install.sh"
set -e

SRC="$(dirname "$0")/luci-app-mhtools"
echo "=== MHTools LuCI Installer ==="

# --- 创建目录 ---
mkdir -p /etc/init.d
mkdir -p /etc/config
mkdir -p /etc/uci-defaults
mkdir -p /usr/libexec
mkdir -p /usr/share/luci/menu.d
mkdir -p /usr/share/rpcd/acl.d
mkdir -p /usr/share/rpcd/ucode
mkdir -p /www/luci-static/resources/tools
mkdir -p /www/luci-static/resources/view/mhtools
mkdir -p /etc/mhtools/profiles
mkdir -p /etc/mhtools/run/mihomo
mkdir -p /var/log/mhtools

# --- 拷贝文件 ---
cp -f "$SRC/root/etc/init.d/mhtools"              /etc/init.d/mhtools
if ! uci show mhtools >/dev/null 2>&1; then
	cp -f "$SRC/root/etc/config/mhtools" /etc/config/mhtools
fi
cp -f "$SRC/root/etc/uci-defaults/80-mhtools-init" /etc/uci-defaults/80-mhtools-init
cp -f "$SRC/root/usr/libexec/mhtools-wrapper"      /usr/libexec/mhtools-wrapper
cp -f "$SRC/root/usr/share/luci/menu.d/luci-app-mhtools.json" /usr/share/luci/menu.d/luci-app-mhtools.json
cp -f "$SRC/root/usr/share/rpcd/acl.d/luci-app-mhtools.json" /usr/share/rpcd/acl.d/luci-app-mhtools.json
cp -f "$SRC/root/usr/share/rpcd/ucode/luci.mhtools" /usr/share/rpcd/ucode/luci.mhtools
cp -f "$SRC/htdocs/luci-static/resources/tools/mhtools.js"  /www/luci-static/resources/tools/mhtools.js
cp -f "$SRC/htdocs/luci-static/resources/view/mhtools/overview.js" /www/luci-static/resources/view/mhtools/overview.js
cp -f "$SRC/htdocs/luci-static/resources/view/mhtools/log.js"      /www/luci-static/resources/view/mhtools/log.js

# --- 写入项目版本号 ---
echo "2.0.0" > /etc/mhtools/version

# --- 权限 ---
chmod +x /etc/init.d/mhtools
chmod +x /usr/libexec/mhtools-wrapper
chmod 755 /etc/mhtools
chmod 755 /etc/mhtools/profiles
chmod 755 /etc/mhtools/run

# --- 初始化 ---
sh /etc/uci-defaults/80-mhtools-init 2>/dev/null || true

# --- 清空 LuCI 模版缓存 ---
rm -f /tmp/luci-indexcache /tmp/luci-modulecache/* 2>/dev/null || true

# --- 启用服务 ---
/etc/init.d/mhtools enable 2>/dev/null || true
/etc/init.d/rpcd restart 2>/dev/null || true

# --- 更新资源版本号（强制浏览器刷新JS缓存） ---
touch /lib/apk/db/installed 2>/dev/null || true

echo ""
echo "=== 安装完成 ==="
echo ""
echo "1. 上传 Mihomo 内核："
echo "   wget -O /usr/bin/mihomo.gz \"https://github.com/MetaCubeX/mihomo/releases/download/v1.19.29/mihomo-linux-arm64-v1.19.29.gz\""
echo "   gunzip /usr/bin/mihomo.gz"
echo "   chmod +x /usr/bin/mihomo"
echo ""
echo "2. 上传完整 YAML 配置文件到 LuCI 界面"
echo "3. 选用配置 → 启动服务"
echo ""
echo "进入 LuCI → 服务 → MHTools 开始使用"
