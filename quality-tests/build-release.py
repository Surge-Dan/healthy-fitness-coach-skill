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

PRIVATE_DATA_PATTERNS = (
    ('WeChat account id', re.compile(r'wxid_[a-zA-Z0-9]+')),
    ('WeChat local cache', re.compile(r'(?:^|[/\\])xwechat_files(?:[/\\]|$)', re.IGNORECASE)),
    ('Windows user home', re.compile(r'(?<![A-Za-z0-9+.-])[A-Za-z]:[/\\]+Users[/\\]+(?!Public(?:[/\\]|$))[^/\\\s<>"|?*]+', re.IGNORECASE)),
    ('Windows WeChat home', re.compile(r'(?<![A-Za-z0-9+.-])[A-Za-z]:[/\\]+WeChat(?: Files)?(?:[/\\]|$)', re.IGNORECASE)),
    ('macOS user home', re.compile(r'(?<![A-Za-z0-9+.-])/Users/(?!Shared(?:/|$)|Public(?:/|$))[^/\s]+')),
    ('Linux user home', re.compile(r'(?<![A-Za-z0-9+.-])/home/(?!shared?(?:/|$)|public(?:/|$))[^/\s]+', re.IGNORECASE)),
    ('private key', re.compile(r'-----BEGIN .*PRIVATE KEY-----')),
    ('OpenAI key', re.compile(r'\bsk-[A-Za-z0-9]{24,}')),
    ('AWS access key', re.compile(r'\bAKIA[A-Z0-9]{16}')),
)

def find_private_data(text):
    """Return the first matched privacy rule name, or None for clean text."""
    for name, pattern in PRIVATE_DATA_PATTERNS:
        if pattern.search(text):
            return name
    return None

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
        privacy_match = find_private_data(text)
        if privacy_match:
            raise ValueError(f'Private data pattern ({privacy_match}) in {relative}')
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

def build_plugin():
    source = ROOT / 'healthy-fitness-coach-plugin'
    entries = []
    for file in sorted(source.rglob('*')):
        if not file.is_file():
            continue
        relative = file.relative_to(source)
        if any(part in {'node_modules', '__pycache__', 'fitness-reports', '.tmp-preview'} for part in relative.parts):
            continue
        allowed = relative.parts[0] in {'.codex-plugin', '.mcp.json', 'README.md', 'scripts', 'skills'}
        if relative.parts[:2] == ('mcp', 'xunji'):
            allowed = len(relative.parts) >= 3 and relative.parts[2] in {'src', 'scripts', 'test', 'package.json', 'package-lock.json'}
        if not allowed or file.suffix in {'.pyc', '.pyo'}:
            continue
        data = file.read_bytes()
        privacy_match = find_private_data(data.decode('utf-8'))
        if privacy_match:
            raise ValueError(f'Private data pattern ({privacy_match}) in Plugin {relative}')
        entries.append((source.name + '/' + relative.as_posix(), data))
    target = ROOT / 'dist' / 'healthy-fitness-coach-plugin.zip'
    with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for name, data in entries:
            info = zipfile.ZipInfo(name, (2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, data)
    with zipfile.ZipFile(target) as archive:
        assert archive.testzip() is None
        assert len(archive.namelist()) == len(entries)
        for name, data in entries:
            assert archive.read(name) == data
    print(f'PASS Plugin {len(entries)} files; SHA256 {hashlib.sha256(target.read_bytes()).hexdigest()}')
    return target


def verify(target):
    # Only extract the freshly audited archive, in a new isolated temp directory.
    with tempfile.TemporaryDirectory(prefix='fitness-release-check-') as temporary:
        with zipfile.ZipFile(target) as archive:
            archive.extractall(temporary)
        skill = Path(temporary) / SOURCE.name
        result = subprocess.run(['node', '--test', *[str(p) for p in sorted((skill / 'tests').glob('*.test.js'))]], cwd=skill, capture_output=True, text=True, encoding='utf-8', errors='replace')
        print('\n'.join(result.stdout.splitlines()[-12:]))
        if result.returncode:
            print(result.stdout)
            print(result.stderr)
            raise SystemExit(result.returncode)
        for script in (skill / 'scripts').glob('*.py'):
            compile(script.read_text(encoding='utf-8-sig'), script.name, 'exec')
        print('PASS extracted complete distributed test suite and Python syntax')

if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    target = build()
    build_plugin()
    if '--verify' in sys.argv:
        verify(target)
