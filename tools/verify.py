# -*- coding: utf-8 -*-
"""Check that dist/ contains exactly the current playable site and its assets."""

from pack import ROOT, DIST, collect


def main():
    expected = set(collect()) | {'.nojekyll'}
    actual = {p.relative_to(DIST).as_posix() for p in DIST.rglob('*') if p.is_file()}
    problems = []
    for rel in sorted(expected - actual):
        problems.append('missing file: ' + rel)
    for rel in sorted(actual - expected):
        problems.append('unexpected file: ' + rel)
    for rel in sorted((expected & actual) - {'.nojekyll'}):
        if (DIST / rel).read_bytes() != (ROOT / rel).read_bytes():
            problems.append('stale or modified file: ' + rel)
    if problems:
        print('BUILD VERIFICATION FAILED')
        for problem in problems:
            print('  * ' + problem)
        raise SystemExit(1)
    print('verified: entry page and %d runtime assets; no password gate.' % (len(expected) - 2))


if __name__ == '__main__':
    main()
