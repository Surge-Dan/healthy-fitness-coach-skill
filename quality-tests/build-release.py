"""Build a reproducible standalone Skill ZIP and audit every distributed file."""
from pathlib import Path
import hashlib
import re
import zipfile
import subprocess
import tempfile
import sys

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'healthy-fitness-coach'
EXCLUDED_TESTS = {'paired-evaluation.test.js'}

def build():
    entries = []
    for file in sorted(SOURCE.rglob('*')):
        if not file.is_file():
            continue
        relative = file.relative_to(SOURCE)
        if any(part in {'__pycache__', 'node_modules'} for part in relative.parts):
            continue
        if relative.parts[0] not in {'SKILL.md', 'LICENSE', 'agents', 'assets', 'references', 'scripts', 'tests'}:
            continue
        if file.suffix in {'.pyc', '.pyo'} or file.name in EXCLUDED_TESTS:
            continue
        data = file.read_bytes()
        text = data.decode('utf-8')
        for pattern in (r'wxid_[a-zA-Z0-9]+', r'[A-Za-z]:[/\\]Users[/\\](?!Public\b)[^/\\\s]+', r'-----BEGIN .*PRIVATE KEY-----', r'\bsk-[A-Za-z0-9]{24,}', r'\bAKIA[A-Z0-9]{16}'):
            if re.search(pattern, text):
                raise ValueError(f'Private data pattern in {relative}')
        entries.append((relative.as_posix(), data))
    target = ROOT / 'dist' / 'healthy-fitness-coach.zip'
    target.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for relative, data in entries:
            info = zipfile.ZipInfo('healthy-fitness-coach/' + relative, (2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, data)
    with zipfile.ZipFile(target) as archive:
        assert archive.testzip() is None
        assert len(archive.namelist()) == len(entries)
        for relative, data in entries:
            assert archive.read('healthy-fitness-coach/' + relative) == data
    data = target.read_bytes()
    target.with_suffix('.skill').write_bytes(data)
    print(f'PASS {len(entries)} files; {len(data)} bytes; SHA256 {hashlib.sha256(data).hexdigest()}')
    return target

def verify(target):
    # Only extract the freshly audited archive, in a new isolated temp directory.
    with tempfile.TemporaryDirectory(prefix='fitness-release-check-') as temporary:
        with zipfile.ZipFile(target) as archive:
            archive.extractall(temporary)
        skill = Path(temporary) / SOURCE.name
        result = subprocess.run(['node', '--test', 'tests'], cwd=skill, capture_output=True, text=True, encoding='utf-8', errors='replace')
        print('\n'.join(result.stdout.splitlines()[-12:]))
        if result.returncode:
            print(result.stdout)
            print(result.stderr)
            raise SystemExit(result.returncode)
        for script in (skill / 'scripts').glob('*.py'):
            compile(script.read_text(encoding='utf-8-sig'), script.name, 'exec')
        print('PASS extracted complete distributed test suite and Python syntax')

if __name__ == '__main__':
    target = build()
    if '--verify' in sys.argv:
        verify(target)
