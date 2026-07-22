# MHTools

MHTools 是一个面向 OpenWrt / ImmortalWrt 的轻量级 LuCI 管理器。

当前实现方式为：
- LuCI 页面只负责上传、启动、停止、查看日志
- 真正的代理执行内核使用外部 `mihomo`
- 配置文件使用单一 YAML
- 运行时依赖通过系统包管理器自动补齐

这不是一个“把内核打进包里”的编译产品，而是一个“薄 LuCI + 外部内核”的轻量发布方案。

## 版本说明

- `v2.1.0`
  - 统一收敛为当前架构：`apk` 依赖装配 + 外部 `mihomo` 二进制
  - 移除对复杂 SDK / 编译链的依赖
  - 保持安装体验简洁，UI 只做最小管理功能

## 安装

```sh
wget https://github.com/luke029/MHTools/releases/latest/download/mhtools-v2.1.0.tar.gz

tar xzf mhtools-v2.1.0.tar.gz
cd MHTools
sh install.sh
```

## 安装脚本会做什么

`install.sh` 会自动完成以下动作：
- 检测当前系统是否为 OpenWrt / ImmortalWrt
- 通过当前包管理器补齐基础依赖
  - `kmod-tun`
  - `nftables`
  - `python3-yaml`
  - `ca-certificates`
  - `wget-ssl`
  - `curl`
- 优先复用已有 `/usr/bin/mihomo`
- 如未找到，则尝试从外部镜像下载安装对应架构的 `mihomo` 二进制
- 拷贝 LuCI 页面与系统脚本，注册服务，并生成卸载清单

如果你要使用 `alpha` 版本内核，可以在安装前设置：

```sh
MIHOMO_CHANNEL=alpha MIHOMO_VER=vX.Y.Z-alpha sh install.sh
```

## 使用方式

1. 打开 LuCI → Services → MHTools
2. 上传你的 `mihomo` 配置文件（`.yaml`）
3. 启动服务
4. 通过日志页面查看运行输出

## 卸载

```sh
sh uninstall.sh
```

卸载脚本会依据安装时生成的清单移除本项目的文件、停止并禁用服务、清理运行时目录。

> 注意：`mihomo` 二进制属于外部依赖，不会强制删除；只有安装时创建的软链才会被清理。

## 目录概览

```text
MHTools/
├── VERSION
├── install.sh
├── uninstall.sh
└── luci-app-mhtools/
```

## License

MIT
