#!/usr/bin/env python3
"""
MHTools Release Builder
Builds a tar.gz release package containing install.sh + luci-app-mhtools/
"""
import argparse
import os
import sys
import tarfile
from pathlib import Path


def get_version(root: Path) -> str:
    """Read version from VERSION file."""
    version_file = root / "VERSION"
    if version_file.exists():
        return version_file.read_text().strip()
    return "0.0.0"


def build_tarball(root: Path, output: Path) -> int:
    """Create tar.gz with install.sh and luci-app-mhtools/ directory."""
    version = get_version(root)

    install_script = root / "install.sh"
    pkg_dir = root / "luci-app-mhtools"

    if not install_script.exists():
        print(f"ERROR: install.sh not found at {install_script}", file=sys.stderr)
        return 1
    if not pkg_dir.is_dir():
        print(f"ERROR: luci-app-mhtools/ not found at {pkg_dir}", file=sys.stderr)
        return 1

    # Collect all files under install.sh and luci-app-mhtools/
    files_to_pack = []
    files_to_pack.append(("install.sh", install_script, install_script.stat()))

    for fpath in sorted(pkg_dir.rglob("*")):
        if fpath.is_file():
            arcname = fpath.relative_to(root)
            files_to_pack.append((str(arcname), fpath, fpath.stat()))

    # Create tar.gz
    output.parent.mkdir(parents=True, exist_ok=True)
    with tarfile.open(output, "w:gz") as tar:
        for arcname, fpath, stat_info in files_to_pack:
            ti = tarfile.TarInfo(name=arcname)
            ti.size = stat_info.st_size
            ti.mode = stat_info.st_mode
            ti.mtime = stat_info.st_mtime
            ti.uid = 0
            ti.gid = 0
            ti.uname = "root"
            ti.gname = "root"
            with open(fpath, "rb") as f:
                tar.addfile(ti, f)

    size_mb = output.stat().st_size / (1024 * 1024)
    print(f"✓ Package built: {output.name} ({size_mb:.2f} MB)")
    print(f"  Version: {version}")
    print(f"  Files: {len(files_to_pack)}")

    return 0


def main():
    parser = argparse.ArgumentParser(description="Build MHTools release tarball")
    parser.add_argument("--root", default=None,
                        help="Project root directory (default: auto-detect)")
    parser.add_argument("--output", "-o", default=None,
                        help="Output tarball path")
    args = parser.parse_args()

    # Auto-detect project root
    if args.root:
        root = Path(args.root).resolve()
    else:
        root = Path(__file__).resolve().parent.parent

    if not (root / "VERSION").exists():
        print(f"ERROR: {root} does not look like MHTools project root", file=sys.stderr)
        return 1

    # Determine output path
    if args.output:
        output = Path(args.output)
    else:
        version = get_version(root)
        output = root / f"mhtools-v{version}.tar.gz"

    return build_tarball(root, output)


if __name__ == "__main__":
    sys.exit(main())
