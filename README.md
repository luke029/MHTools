# MHTools

OpenWrt / ImmortalWrt 上管理 [mihomo](https://github.com/MetaCubeX/mihomo) 代理的 LuCI 应用。

## 安装

```bash
# 下载并解压
wget https://github.com/luke029/MHTools/releases/latest/download/mhtools-v2.0.3.tar.gz
tar xzf mhtools-v2.0.3.tar.gz

# 一键安装（自动处理依赖）
sh install.sh
```

`install.sh` 会自动：
- 检测并安装 `kmod-tun`（通过系统包管理器）
- 下载对应架构的 mihomo 内核二进制
- 拷贝所有文件并注册服务

## 手动打包

```bash
tar czf mhtools-vX.X.X.tar.gz install.sh luci-app-mhtools/
```

## 目录结构

```
MHTools/
├── VERSION
├── install.sh                         # 安装脚本
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
