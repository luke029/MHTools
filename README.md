# MHTools

OpenWrt / ImmortalWrt 上管理 [mihomo](https://github.com/MetaCubeX/mihomo) 代理的 LuCI 应用。

本项目当前采用“轻量 LuCI 管理层 + 外部 mihomo 内核”的实现方式：
- LuCI 页面只负责上传 YAML、启动/停止、状态和日志
- `mihomo` 二进制保持外置
- 运行时依赖通过系统包管理器自动补齐
- 不再把内核打进包里，也不再依赖复杂 SDK 编译链

## 安装

```bash
# 下载并解压
wget https://github.com/luke029/MHTools/releases/latest/download/mhtools-v2.1.0.tar.gz
tar xzf mhtools-v2.1.0.tar.gz

# 一键安装（自动处理依赖）
sh install.sh
```

`install.sh` 会自动：
- 通过当前系统包管理器安装基础依赖（`apk` 优先）：`kmod-tun`、`nftables`、`python3-yaml`、`ca-certificates`、`wget-ssl`、`curl`
- 复用已有 `/usr/bin/mihomo`；若不存在则尝试下载对应架构的二进制
- 拷贝所有文件、注册服务，并生成安装清单 `/usr/share/mhtools/manifest`

如果你要下载 `alpha` 内核版本，可以在安装前设置：

```sh
MIHOMO_CHANNEL=alpha MIHOMO_VER=vX.Y.Z-alpha sh install.sh
```

## 卸载

```bash
sh uninstall.sh
```

`uninstall.sh` 依据安装清单精确移除 MHTools 自有文件、停止并禁用服务、清理运行时数据目录。
> 注意：mihomo 内核为外部依赖，默认保留；仅当它是安装时创建的软链时才会被移除。

## 手动打包

```bash
tar czf mhtools-vX.X.X.tar.gz install.sh uninstall.sh luci-app-mhtools/
```

## 目录结构

```
MHTools/
├── VERSION
├── install.sh                         # 安装脚本
├── uninstall.sh                       # 卸载脚本（依据安装清单精确清理）
└── luci-app-mhtools/
    ├── htdocs/                        # LuCI 前端页面
    └── root/
        ├── etc/config/mhtools          # UCI 配置定义
        ├── etc/init.d/mhtools          # 服务管理脚本
        ├── etc/uci-defaults/           # 首次安装初始化
        └── usr/
            ├── libexec/mhtools-wrapper # 权限代理
            └── share/
                ├── luci/menu.d/        # 菜单注册
                └── rpcd/               # Lua → ucode 中间层
```

## 使用

1. 打开 LuCI → Services → MHTools
2. 上传 mihomo 配置文件（`.yaml`）
3. 启用并启动服务

## 依赖

安装脚本自动处理所有依赖，无需手动安装。

## License

MIT
