# -*- coding: utf-8 -*-
"""Build the playable site in dist/ without a password or decryption step.

Run: python tools/pack.py
Only the entry page and runtime assets are published.
"""

from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / 'dist'
INCLUDE_DIRS = ('js', 'styles', 'art')
INCLUDE_FILES = ('index.html',)


def collect():
    files = list(INCLUDE_FILES)
    for name in INCLUDE_DIRS:
        for path in sorted((ROOT / name).rglob('*')):
            rel = path.relative_to(ROOT)
            if (path.is_file() and not any(p.startswith('.') for p in rel.parts)
                    and path.suffix.lower() != '.md'
                    and rel.as_posix() != 'art/tiles/computed.json'):
                files.append(rel.as_posix())
    return files


def main():
    # Resolve the deletion target before cleaning; never follow a redirected dist/.
    if DIST.is_symlink() or DIST.resolve() != ROOT / 'dist':
        raise SystemExit('refusing to replace dist/: it points outside the build directory')
    files = collect()
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir()
    for rel in files:
        target = DIST / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / rel, target)
    (DIST / '.nojekyll').touch()
    print('built %d files in %s; opens directly without a password.' % (len(files), DIST))


if __name__ == '__main__':
    main()
