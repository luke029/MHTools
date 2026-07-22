#!/usr/bin/env python3
"""
MHTools APK v3 打包工具
在 macOS 上生成 OpenWRT/ImmortalWrt 兼容的 APK 包
APK v3 格式：ADB (Android Debug Bridge) 二进制格式 + deflate 压缩

参考: Alpine Linux apk-tools 源码, adumpk 解析工具
"""

import struct
import hashlib
import zlib
import os
import sys
import time
from typing import Optional
from dataclasses import dataclass, field

# ============ ADB 常量 ============

# 压缩方式
ADB_COMP_NONE = 0x2e     # '.'
ADB_COMP_DEFLATE = 0x64  # 'd'

# Schema
ADB_SCHEMA_PACKAGE = 0x676B6370  # 'pckg' little-endian

# Block 类型
ADB_BLOCK_ADB = 0
ADB_BLOCK_SIG = 1
ADB_BLOCK_DATA = 2

# Value 类型 (高4位)
ADB_VAL_SPECIAL = 0x00000000
ADB_VAL_INT = 0x10000000
ADB_VAL_INT32 = 0x20000000
ADB_VAL_INT64 = 0x30000000
ADB_VAL_BLOB8 = 0x80000000
ADB_VAL_BLOB16 = 0x90000000
ADB_VAL_BLOB32 = 0xA0000000
ADB_VAL_ARRAY = 0xD0000000
ADB_VAL_OBJECT = 0xE0000000

# Special values
ADB_SPECIAL_NULL = 0
ADB_SPECIAL_TRUE = 1
ADB_SPECIAL_FALSE = 2

# PKGINFO 字段 ID
PKGINFO_NAME = 1
PKGINFO_VERSION = 2
PKGINFO_DESCRIPTION = 4
PKGINFO_ARCH = 5
PKGINFO_LICENSE = 6
PKGINFO_ORIGIN = 7
PKGINFO_MAINTAINER = 8
PKGINFO_URL = 9
PKGINFO_BUILD_TIME = 11
PKGINFO_INSTALLED_SIZE = 12
PKGINFO_PROVIDER_PRIORITY = 14
PKGINFO_DEPENDS = 15
PKGINFO_PROVIDES = 16

# Script 字段 ID
SCRIPT_PREINST = 2
SCRIPT_POSTINST = 3
SCRIPT_PREDEINST = 4
SCRIPT_POSTDEINST = 5
SCRIPT_PREUPGRADE = 6
SCRIPT_POSTUPGRADE = 7

# 文件字段
FILE_NAME = 1
FILE_ACL = 2
FILE_SIZE = 3
FILE_MTIME = 4
FILE_HASHES = 5

# ACL 字段
ACL_MODE = 1
ACL_USER = 2
ACL_GROUP = 3

# DEPEND 字段
DEP_NAME = 1
DEP_VERSION = 2
DEP_MATCH = 3


# ============ 写入器 ============

class AdbWriter:
    """ADB 二进制格式写入器"""
    
    def __init__(self):
        # 预留 8 字节: [4字节 prefix=0x00000000] [4字节 root_val placeholder]
        self.data = bytearray(b'\x00' * 8)
    
    def u32(self, val: int) -> bytes:
        return struct.pack('<I', val & 0xFFFFFFFF)
    
    def u64(self, val: int) -> bytes:
        return struct.pack('<Q', val & 0xFFFFFFFFFFFFFFFF)
    
    def append(self, data: bytes) -> int:
        """追加数据，返回偏移"""
        offset = len(self.data)
        self.data.extend(data)
        return offset
    
    def append_aligned(self, data: bytes, align: int = 4) -> int:
        """追加数据并对齐到 align 边界"""
        offset = self.append(data)
        while len(self.data) % align != 0:
            self.data.append(0)
        return offset
    
    def val_null(self) -> int:
        """NULL special value"""
        return ADB_SPECIAL_NULL
    
    def val_bool(self, v: bool) -> int:
        return ADB_SPECIAL_TRUE if v else ADB_SPECIAL_FALSE
    
    def val_int(self, v: int) -> int:
        """内联小整数 (0-268435455)"""
        if v > 0x0FFFFFFF:
            raise ValueError(f"INT overflow: {v}")
        return ADB_VAL_INT | v
    
    def val_int32(self, v: int) -> int:
        """32位整数 (间接存储)"""
        offset = self.append(self.u32(v))
        return ADB_VAL_INT32 | offset
    
    def val_int64(self, v: int) -> int:
        """64位整数 (间接存储)"""
        offset = self.append(self.u64(v))
        return ADB_VAL_INT64 | offset
    
    def val_blob8(self, data: bytes) -> int:
        """变长二进制 (长度 < 256)"""
        if len(data) >= 256:
            return self.val_blob16(data)
        offset = self.append(bytes([len(data)]) + data)
        return ADB_VAL_BLOB8 | offset
    
    def val_blob16(self, data: bytes) -> int:
        """变长二进制 (长度 < 65536)"""
        if len(data) >= 65536:
            return self.val_blob32(data)
        offset = self.append(struct.pack('<H', len(data)) + data)
        return ADB_VAL_BLOB16 | offset
    
    def val_blob32(self, data: bytes) -> int:
        """变长二进制 (任意长度)"""
        offset = self.append(self.u32(len(data)) + data)
        return ADB_VAL_BLOB32 | offset
    
    def val_str(self, s: str) -> int:
        """字符串 (UTF-8)"""
        return self.val_blob8(s.encode('utf-8'))
    
    def val_array(self, items: list) -> int:
        """数组: [count, item1, item2, ...]"""
        count = len(items) + 1  # 包括 count 自身
        # 预留空间
        offset = len(self.data)
        self.data.extend(b'\x00' * (count * 4))
        # 写入 count
        struct.pack_into('<I', self.data, offset, count)
        for i, item in enumerate(items):
            struct.pack_into('<I', self.data, offset + (i + 1) * 4, item)
        return ADB_VAL_ARRAY | offset
    
    def val_object(self, items: list) -> int:
        """对象 (与数组相同格式，用 OBJECT type 标记)"""
        count = len(items) + 1  # 包括 count 自身
        offset = len(self.data)
        self.data.extend(b'\x00' * (count * 4))
        struct.pack_into('<I', self.data, offset, count)
        for i, item in enumerate(items):
            struct.pack_into('<I', self.data, offset + (i + 1) * 4, item)
        return ADB_VAL_OBJECT | offset
    
    def val_depend(self, name: str, version: str = "", match: int = 1) -> int:
        """依赖项"""
        fields = [ADB_SPECIAL_NULL] * 3  # NAME=1, VERSION=2, MATCH=3
        fields[0] = self.val_str(name)
        if version:
            fields[1] = self.val_str(version)
        fields[2] = self.val_int(match)
        return self.val_object(fields)
    
    def get_bytes(self) -> bytes:
        return bytes(self.data)


def build_pkginfo(w: AdbWriter, pkg: dict) -> int:
    """构建 PKGINFO 对象"""
    # 使用字典存储字段
    fields_dict = {}
    
    def set_field(fid, val):
        fields_dict[fid] = val
    
    set_field(PKGINFO_NAME, w.val_str(pkg['name']))
    set_field(PKGINFO_VERSION, w.val_str(pkg['version']))
    if pkg.get('description'):
        set_field(PKGINFO_DESCRIPTION, w.val_str(pkg['description']))
    set_field(PKGINFO_ARCH, w.val_str(pkg['arch']))
    if pkg.get('license'):
        set_field(PKGINFO_LICENSE, w.val_str(pkg['license']))
    if pkg.get('origin'):
        set_field(PKGINFO_ORIGIN, w.val_str(pkg['origin']))
    if pkg.get('maintainer'):
        set_field(PKGINFO_MAINTAINER, w.val_str(pkg['maintainer']))
    if pkg.get('url'):
        set_field(PKGINFO_URL, w.val_str(pkg['url']))
    set_field(PKGINFO_BUILD_TIME, w.val_int64(int(time.time())))
    set_field(PKGINFO_INSTALLED_SIZE, w.val_int(pkg.get('installed_size', 0)))
    
    # 依赖
    if pkg.get('depends'):
        deps = [w.val_depend(d) for d in pkg['depends']]
        set_field(PKGINFO_DEPENDS, w.val_array(deps))
    
    # 提供
    if pkg.get('provides'):
        provs = [w.val_depend(p) for p in pkg['provides']]
        set_field(PKGINFO_PROVIDES, w.val_array(provs))
    
    # 构建字段数组（按 ID 排序）
    max_id = max(fields_dict.keys()) if fields_dict else 0
    fields_list = [ADB_SPECIAL_NULL] * max_id
    for fid, val in fields_dict.items():
        fields_list[fid - 1] = val
    
    # 移除尾部的 NULL
    while fields_list and fields_list[-1] == ADB_SPECIAL_NULL:
        fields_list.pop()
    
    return w.val_object(fields_list)


@dataclass
class PackageFile:
    """包内文件信息"""
    path: str          # 相对路径 (如 "etc/init.d/mhtools")
    content: bytes     # 文件内容
    mode: int = 0o644  # 权限
    is_dir: bool = False
    target: str = ""   # 符号链接目标
    
    @property
    def size(self) -> int:
        if self.is_dir:
            return 0
        return len(self.content)
    
    @property
    def acl_mode(self) -> int:
        """转换为 APK ACL mode 格式"""
        if self.is_dir:
            return 0o40000 | self.mode  # S_IFDIR
        return 0o100000 | self.mode      # S_IFREG


def collect_files(root_dir: str) -> list[PackageFile]:
    """收集目录下的所有文件"""
    result = []
    seen_paths = set()  # 去重
    
    for dirpath, dirnames, filenames in os.walk(root_dir):
        # 计算相对路径
        rel = os.path.relpath(dirpath, root_dir)
        if rel == '.':
            rel = ''
        
        # 添加目录
        parts = rel.split(os.sep) if rel else []
        current = ''
        for part in parts:
            if not part:
                continue
            current = os.path.join(current, part) if current else part
            if current not in seen_paths:
                seen_paths.add(current)
                result.append(PackageFile(
                    path=current,
                    content=b'',
                    mode=0o755,
                    is_dir=True
                ))
        
        # 添加文件
        for fname in sorted(filenames):
            fpath = os.path.join(dirpath, fname)
            rel_path = os.path.join(rel, fname) if rel else fname
            
            if rel_path in seen_paths:
                continue
            seen_paths.add(rel_path)
            
            # 检查是否是符号链接
            if os.path.islink(fpath):
                target = os.readlink(fpath)
                result.append(PackageFile(
                    path=rel_path,
                    content=b'',
                    mode=0o777,
                    target=target
                ))
            else:
                with open(fpath, 'rb') as f:
                    content = f.read()
                
                # 获取权限
                st = os.stat(fpath)
                mode = st.st_mode & 0o777
                
                result.append(PackageFile(
                    path=rel_path,
                    content=content,
                    mode=mode if mode else 0o644
                ))
    
    return result


def build_paths_and_files(w: AdbWriter, files: list[PackageFile]) -> tuple:
    """
    构建 PATHS 对象和文件索引列表
    返回 (paths_val, file_indices)
    file_indices: list of (path_index, file_index) 用于 DATA 块
    """
    # 收集所有唯一路径
    # 构建目录树结构
    # ADB 格式中路径是层级化的：目录包含子文件和子目录
    
    # 简化方案：将所有文件平铺，每个文件/目录有独立的路径条目
    # 实际上 APK v3 使用 parent-child 关系
    
    # 先构建路径索引
    path_list = []  # list of (parent_idx, name)
    file_entries = []  # list of (path_idx, file_val)
    
    # 首先添加根目录 "/"
    path_list.append((-1, ""))  # parent=-1, name="" = root
    
    # 按路径排序
    sorted_files = sorted(files, key=lambda f: f.path)
    
    for pf in sorted_files:
        parts = pf.path.split('/')
        
        # 确保所有父目录存在
        for depth in range(len(parts)):
            partial = '/'.join(parts[:depth+1])
            # 检查是否已存在
            found = False
            for idx, (parent, name) in enumerate(path_list):
                if depth == 0:
                    # 顶层目录：parent 是 root (idx=0)
                    if name == parts[0]:
                        found = True
                        break
                else:
                    # 检查 parent
                    parent_path = '/'.join(parts[:depth])
                    parent_idx = None
                    for pi, (pp, pn) in enumerate(path_list):
                        if pn == parts[depth-1] and pp >= 0:
                            if parts[:depth] == [path_list[pp][1]] + [pn]:
                                parent_idx = pi
                                break
                    # 简化：直接用 name 匹配
                    if name == parts[depth] and parent >= 0:
                        found = True
                        break
            
            if not found:
                # 找到父目录的索引
                parent_idx = 0  # root
                if depth > 0:
                    for pi, (pp, pn) in enumerate(path_list):
                        if pn == parts[depth-1]:
                            parent_idx = pi
                            break
                path_list.append((parent_idx, parts[depth]))
    
    # 构建 ADB 路径对象数组
    # 格式: [parent_dir_obj, parent_dir_obj, ...]
    # 每个 dir_obj: {NAME: str, ACL: acl_obj, FILES: [file_obj, ...]}
    # FILES 中的每个 file_obj: {NAME: str, ACL: acl_obj, SIZE: int, MTIME: int, HASHES: blob}
    
    # 简化方案：构建扁平的 PATHS 数组
    # 每个条目是目录对象
    
    # 实际 APK 格式使用嵌套结构
    # 但为了简化，我们先试平铺方案
    
    # 构建目录结构
    # path_tree[parent_idx] = [(child_path_idx, name, is_last)]
    
    dir_objects = {}  # path_idx -> dir_obj_val
    
    # 先创建所有目录对象（空的 FILES 数组）
    for idx, (parent, name) in enumerate(path_list):
        if idx == 0:
            continue  # 跳过 root
        
        # 构建 ACL
        acl_fields = [ADB_SPECIAL_NULL] * 3
        acl_fields[ACL_MODE - 1] = w.val_int(0o40755)  # 目录 755
        acl_fields[ACL_USER - 1] = w.val_str("root")
        acl_fields[ACL_GROUP - 1] = w.val_str("root")
        acl_val = w.val_object(acl_fields)
        
        # 构建目录对象
        dir_fields = [ADB_SPECIAL_NULL] * 3  # NAME, ACL, FILES
        dir_fields[FILE_NAME - 1] = w.val_str(name)
        dir_fields[FILE_ACL - 1] = w.val_str("") if idx == 0 else acl_val
        dir_fields[2] = w.val_array([])  # FILES = 空数组
        
        dir_objects[idx] = w.val_object([f for f in dir_fields if f != ADB_SPECIAL_NULL])
    
    # 现在为每个文件添加到对应目录的 FILES 数组中
    # 简化：重新构建
    
    return w.val_array(list(dir_objects.values())), file_entries


def build_apk_v3(pkg_info: dict, files: list[PackageFile], 
                  scripts: dict = None, output_path: str = None) -> bytes:
    """
    构建 APK v3 格式的包
    
    pkg_info: 包元数据
    files: 文件列表
    scripts: 脚本字典 {name: content}
    output_path: 输出文件路径（可选）
    
    返回 APK 文件的字节内容
    """
    w = AdbWriter()
    
    # ============ 1. 构建 PKGINFO ============
    pkginfo_val = build_pkginfo(w, pkg_info)
    
    # ============ 2. 构建 PATHS 和 FILES ============
    # 简化方案：构建路径列表和文件列表
    # APK v3 的 PATHS 结构比较复杂，这里使用经过测试的最小化方案
    
    # 收集所有目录
    dirs_set = set()
    for pf in files:
        parts = pf.path.split('/')
        # 文件路径需要排除文件名本身（最后一部分不应作为目录）
        end = len(parts) if pf.is_dir else len(parts) - 1
        for i in range(end):
            partial = '/'.join(parts[:i+1])
            dirs_set.add(partial)
    
    sorted_dirs = sorted(dirs_set, key=lambda d: (d.count('/'), d))
    
    # 构建文件对象
    file_vals = []
    file_data_blocks = []  # (path_str, data_blob, hash_blob) 用于 DATA 块
    
    for pf in sorted(files, key=lambda f: f.path):
        # ACL
        acl_fields = [ADB_SPECIAL_NULL] * 3
        if pf.target:
            # 符号链接
            acl_fields[ACL_MODE - 1] = w.val_int(0o120777)  # S_IFLNK + 0777
        elif pf.is_dir:
            acl_fields[ACL_MODE - 1] = w.val_int(0o40755)   # S_IFDIR + 0755
        else:
            acl_fields[ACL_MODE - 1] = w.val_int(0o100000 | pf.mode)  # S_IFREG + mode
        acl_fields[ACL_USER - 1] = w.val_str("root")
        acl_fields[ACL_GROUP - 1] = w.val_str("root")
        acl_val = w.val_object(acl_fields)
        
        # 文件对象字段
        fname = pf.path.split('/')[-1] if '/' in pf.path else pf.path
        file_fields = [ADB_SPECIAL_NULL] * 6  # NAME, ACL, SIZE, MTIME, HASHES, TARGET
        
        file_fields[FILE_NAME - 1] = w.val_str(fname)
        file_fields[FILE_ACL - 1] = acl_val
        
        if pf.target:
            # 符号链接: TARGET blob = [2字节mode(S_IFLNK)][目标路径]
            target_data = struct.pack('<H', 0o120000) + pf.target.encode('utf-8')
            file_fields[5] = w.val_blob8(target_data)
        elif not pf.is_dir:
            # 普通文件
            file_fields[FILE_SIZE - 1] = w.val_int(pf.size)
            file_fields[FILE_MTIME - 1] = w.val_int64(int(time.time()))
            # 计算哈希
            sha256 = hashlib.sha256(pf.content).digest()
            file_fields[FILE_HASHES - 1] = w.val_blob8(sha256)
            
            file_data_blocks.append({
                'path': pf.path,
                'content': pf.content,
                'hash': sha256
            })
        
        file_val = w.val_object([f for f in file_fields if f != ADB_SPECIAL_NULL])
        file_vals.append((pf.path, file_val))
    
    # ============ 3. 构建 PATHS 数组 ============
    # path -> PackageFile 映射，用于区分文件和目录
    path_to_pf = {pf.path: pf for pf in files}
    
    path_objects = []  # 目录对象
    dir_to_idx = {}    # 路径 -> 对象索引
    
    # 添加根目录
    root_acl_fields = [ADB_SPECIAL_NULL] * 3
    root_acl_fields[ACL_MODE - 1] = w.val_int(0o40755)
    root_acl_fields[ACL_USER - 1] = w.val_str("root")
    root_acl_fields[ACL_GROUP - 1] = w.val_str("root")
    root_acl_val = w.val_object(root_acl_fields)
    
    root_files = []
    root_dir_obj = w.val_object([
        w.val_str(""),           # NAME (空字符串表示根)
        root_acl_val,            # ACL
        w.val_object(root_files) # FILES (OBJECT, 每字段一个文件)
    ])
    path_objects.append(root_dir_obj)
    dir_to_idx[''] = 0
    
    # 添加子目录
    for d in sorted_dirs:
        if d == '':
            continue
        
        parent = os.path.dirname(d) if '/' in d else ''
        parent = '' if parent == '.' else parent
        parent_idx = dir_to_idx.get(parent, 0)
        
        name = d  # 使用完整路径作为目录名（与真实 APK 格式一致）
        
        # ACL for this dir
        d_acl_fields = [ADB_SPECIAL_NULL] * 3
        d_acl_fields[ACL_MODE - 1] = w.val_int(0o40755)
        d_acl_fields[ACL_USER - 1] = w.val_str("root")
        d_acl_fields[ACL_GROUP - 1] = w.val_str("root")
        d_acl_val = w.val_object(d_acl_fields)
        
        # 收集此目录下的文件（仅实际文件/符号链接，不含子目录）
        dir_files = []
        for fpath, fval in file_vals:
            pf = path_to_pf.get(fpath)
            if pf is None or pf.is_dir:
                continue  # 跳过目录条目
            fparent = os.path.dirname(fpath) if '/' in fpath else ''
            fparent = '' if fparent == '.' else fparent
            if fparent == d:
                dir_files.append(fval)
        
        dir_obj = w.val_object([
            w.val_str(name),
            d_acl_val,
            w.val_object(dir_files)
        ])
        path_objects.append(dir_obj)
        dir_to_idx[d] = len(path_objects) - 1
    
    paths_val = w.val_object(path_objects)
    
    # ============ 4. 构建脚本（如果有） ============
    scripts_val = ADB_SPECIAL_NULL
    if scripts:
        script_fields = [ADB_SPECIAL_NULL] * 7
        script_map = {
            'preinst': SCRIPT_PREINST,
            'postinst': SCRIPT_POSTINST,
            'predeinst': SCRIPT_PREDEINST,
            'postdeinst': SCRIPT_POSTDEINST,
            'preupgrade': SCRIPT_PREUPGRADE,
            'postupgrade': SCRIPT_POSTUPGRADE,
        }
        for sname, scontent in (scripts or {}).items():
            sid = script_map.get(sname)
            if sid:
                script_fields[sid - 1] = w.val_blob8(scontent.encode('utf-8') if isinstance(scontent, str) else scontent)
        
        # 移除尾部 NULL
        while script_fields and script_fields[-1] == ADB_SPECIAL_NULL:
            script_fields.pop()
        
        if script_fields and any(f != ADB_SPECIAL_NULL for f in script_fields):
            scripts_val = w.val_object(script_fields)
    
    # ============ 5. 构建根对象 (ADB Block) ============
    # 根对象: {PKGINFO, PATHS, SCRIPTS?, TRIGGERS?}
    root_fields = [ADB_SPECIAL_NULL] * 4  # PKGINFO=1, PATHS=2, SCRIPTS=3, TRIGGERS=4
    root_fields[0] = pkginfo_val
    root_fields[1] = paths_val
    if scripts_val != ADB_SPECIAL_NULL:
        root_fields[2] = scripts_val
    # 不移除尾部 NULL — root 必须保持固定字段结构
    root_val = w.val_object(root_fields)
    
    # ============ 6. 构建文件索引映射 ============
    # file_path -> (path_idx, file_idx)
    # 注意: 必须在 DATA blocks 构建之前确定映射
    file_index_map = {}
    
    # 根目录文件 (path_idx=0)
    for fi, fv in enumerate(root_files):
        for fpath, fval in file_vals:
            if fv is fval and '/' not in fpath:
                file_index_map[fpath] = (0, fi)
                break
    
    # 子目录文件
    for d in sorted_dirs:
        if d == '':
            continue
        d_idx = dir_to_idx.get(d)
        if d_idx is None:
            continue
        fi = 0
        for fpath, fval in file_vals:
            fparent = os.path.dirname(fpath) if '/' in fpath else ''
            if fparent == d or (d == '' and '/' not in fpath):
                file_index_map[fpath] = (d_idx, fi)
                fi += 1
    
    # ============ 7. 构建完整 ADB 流 ============
    # 解压后的数据布局:
    #   "ADB." (4 bytes)
    #   schema (4 bytes, little-endian u32)
    #   ADB Block header (4 bytes) + ADB Block payload
    #   ADB Block payload 内部: [4B prefix=0] [4B root_val] [序列化数据]
    #   8-byte padding (after ADB block)
    #   DATA Block header (4 bytes) + payload + padding × N files
    
    # Patch root_val 到 w.data 的位置 4-7
    struct.pack_into('<I', w.data, 4, root_val)
    adb_payload = bytes(w.data)
    
    raw_stream = bytearray()
    
    # "ADB." magic + schema
    raw_stream.extend(b'ADB.')
    raw_stream.extend(struct.pack('<I', ADB_SCHEMA_PACKAGE))
    
    # ADB Block: block header + payload
    adb_block_size = 4 + len(adb_payload)  # header(4) + payload
    raw_stream.extend(struct.pack('<I', (ADB_BLOCK_ADB << 30) | (adb_block_size & 0x3FFFFFFF)))
    raw_stream.extend(adb_payload)
    
    # 8字节对齐
    while len(raw_stream) % 8 != 0:
        raw_stream.append(0)
    
    # DATA Blocks
    for fb in file_data_blocks:
        fpath = fb['path']
        if fpath not in file_index_map:
            print(f"警告: 文件 {fpath} 未在目录树中找到索引，跳过")
            continue
        p_idx, f_idx = file_index_map[fpath]
        
        data_size = len(fb['content'])
        # block_size = header(4) + path_idx(4) + file_idx(4) + data
        block_size = 4 + 8 + data_size
        raw_stream.extend(struct.pack('<I', (ADB_BLOCK_DATA << 30) | (block_size & 0x3FFFFFFF)))
        # APK 使用 1-based 索引
        raw_stream.extend(struct.pack('<I', p_idx + 1))  # path_idx (1-based)
        raw_stream.extend(struct.pack('<I', f_idx + 1))  # file_idx (1-based)
        raw_stream.extend(fb['content'])
        
        # 8字节对齐
        while len(raw_stream) % 8 != 0:
            raw_stream.append(0)
    
    # ============ 8. 压缩 ============
    full_data = bytes(raw_stream)
    
    # raw deflate (无 zlib 头)
    compressor = zlib.compressobj(level=6, wbits=-zlib.MAX_WBITS)
    compressed = compressor.compress(full_data) + compressor.flush()
    
    # 文件头: "ADB" + compression_byte
    result = b'ADB' + bytes([ADB_COMP_DEFLATE]) + compressed
    
    if output_path:
        with open(output_path, 'wb') as f:
            f.write(result)
        print(f"APK 包已生成: {output_path}")
        print(f"  大小: {len(result)} 字节 ({len(result)/1024:.1f} KB)")
    
    return result


def main():
    """主函数：从项目目录构建 APK 包"""
    import argparse
    
    parser = argparse.ArgumentParser(description='MHTools APK v3 打包工具')
    parser.add_argument('--name', default='luci-app-mhtools', help='包名')
    parser.add_argument('--version', default='2.0.0-r1', help='版本号')
    parser.add_argument('--arch', default='aarch64_cortex-a53', help='目标架构')
    parser.add_argument('--root', default=None, help='项目根目录 (默认: 自动检测)')
    parser.add_argument('--output', '-o', default=None, help='输出文件路径')
    parser.add_argument('--depends', nargs='*', default=['libc', 'mihomo'], help='依赖包列表')
    
    args = parser.parse_args()
    
    # 确定项目根目录
    if args.root:
        root = args.root
    else:
        # 自动检测: 脚本在 scripts/ 下，项目根目录是上一级
        script_dir = os.path.dirname(os.path.abspath(__file__))
        root = os.path.dirname(script_dir)
    
    print(f"项目根目录: {root}")
    
    # 读取版本
    version_file = os.path.join(root, 'VERSION')
    version = args.version
    if os.path.exists(version_file):
        with open(version_file) as f:
            ver = f.read().strip()
            if not args.version or args.version == '2.0.0-r1':
                version = f"{ver}-r1"
    
    # 收集文件
    pkg_root = os.path.join(root, 'luci-app-mhtools')
    if not os.path.isdir(pkg_root):
        print(f"错误: 找不到 luci-app-mhtools 目录在 {root}")
        sys.exit(1)
    
    print(f"收集文件从: {pkg_root}")
    
    # 收集 root/ 和 htdocs/ 下的文件
    all_files = []
    
    # root/ 下的文件映射到 /
    root_dir = os.path.join(pkg_root, 'root')
    if os.path.isdir(root_dir):
        for pf in collect_files(root_dir):
            all_files.append(pf)
    
    # htdocs/ 下的文件映射到 /www/
    htdocs_dir = os.path.join(pkg_root, 'htdocs')
    if os.path.isdir(htdocs_dir):
        for pf in collect_files(htdocs_dir):
            pf.path = 'www/' + pf.path
            all_files.append(pf)
    
    print(f"共 {len(all_files)} 个文件/目录")
    for f in all_files:
        t = 'DIR' if f.is_dir else ('LINK' if f.target else 'FILE')
        print(f"  [{t}] {f.path}" + (f' -> {f.target}' if f.target else ''))
    
    # 计算总安装大小
    total_size = sum(f.size for f in all_files if not f.is_dir and not f.target)
    
    # 构建 PKGINFO
    pkg_info = {
        'name': args.name,
        'version': version,
        'description': 'MHTools - Mihomo TProxy 管理面板 for OpenWRT LuCI',
        'arch': args.arch,
        'license': 'GPL-3.0',
        'origin': 'luke029/MHTools',
        'maintainer': 'luke029',
        'url': 'https://github.com/luke029/MHTools',
        'installed_size': total_size,
        'depends': args.depends,
        'provides': [f'{args.name}-any'],
    }
    
    # 脚本
    scripts = {}
    
    # postinst 脚本：安装后初始化
    postinst = '''#!/bin/sh
# MHTools post-install script
mkdir -p /etc/mhtools/profiles
mkdir -p /etc/mhtools/run/mihomo
mkdir -p /var/log/mhtools
chmod 755 /etc/mhtools
chmod 755 /etc/mhtools/profiles
chmod 755 /etc/mhtools/run

# 写入版本号
echo "''' + version.split('-')[0] + '''" > /etc/mhtools/version

# 启用服务
/etc/init.d/mhtools enable 2>/dev/null || true

# 执行 uci-defaults
[ -f /etc/uci-defaults/80-mhtools-init ] && sh /etc/uci-defaults/80-mhtools-init 2>/dev/null || true

# 清 LuCI 缓存
rm -f /tmp/luci-indexcache /tmp/luci-modulecache/* 2>/dev/null || true

# 重启 rpcd
/etc/init.d/rpcd restart 2>/dev/null || true

# 检查 mihomo 内核
if [ ! -x /usr/bin/mihomo ]; then
    echo "=== MHTools 安装完成 ==="
    echo ""
    echo "Mihomo 内核未检测到。请执行以下命令安装："
    echo "  mhtools-install-core"
    echo ""
    echo "或手动下载："
    echo "  wget -O /usr/bin/mihomo.gz https://github.com/MetaCubeX/mihomo/releases/latest/download/mihomo-linux-arm64-alpha.gz"
    echo "  gunzip /usr/bin/mihomo.gz && chmod +x /usr/bin/mihomo"
else
    echo "=== MHTools 安装完成 ==="
fi
'''
    scripts['postinst'] = postinst
    
    # predeinst 脚本：卸载前清理
    predeinst = '''#!/bin/sh
# MHTools pre-deinstall script
/etc/init.d/mhtools stop 2>/dev/null || true
/etc/init.d/mhtools disable 2>/dev/null || true
'''
    scripts['predeinst'] = predeinst
    
    # 输出路径
    output = args.output
    if not output:
        output = os.path.join(root, f'{args.name}_{version}_{args.arch}.apk')
    
    # 构建
    result = build_apk_v3(pkg_info, all_files, scripts, output)
    
    print(f"\n完成! 输出: {output}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
