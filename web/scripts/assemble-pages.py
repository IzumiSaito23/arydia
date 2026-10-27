"""Restore browser assets, verify the release, and stage only browser files."""
import hashlib
import json
import pathlib
import re
import shutil
import sys
import zipfile

web = pathlib.Path(__file__).resolve().parents[1]
manifest = json.loads((web / 'publish-manifest.json').read_text(encoding='utf-8'))
files = manifest['files']
forbidden = re.compile(r'\.(?:apk|apks|aab|jks|keystore)(?:$|\.)', re.I)

def safe_name(name):
    p = pathlib.PurePosixPath(name)
    if p.is_absolute() or '..' in p.parts or '\\' in name or ':' in name or forbidden.search(name):
        raise ValueError(f'Not a browser asset: {name}')
    return p

for name in files:
    safe_name(name)
archives = [web / 'assets.zip', *sorted((web / 'maintenance-assets').glob('*.zip'))]
for archive in archives:
    with zipfile.ZipFile(archive) as z:
        for info in z.infolist():
            if info.is_dir():
                continue
            name = safe_name(info.filename).as_posix()
            if name not in files:
                continue
            target = web / 'dist' / name
            # Older maintenance bundles must not overwrite newer checked-in fixes.
            payload = z.read(info)
            if hashlib.sha256(payload).hexdigest() != files[name]:
                continue
            if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() == files[name]:
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(payload)

for name, expected in files.items():
    data = (web / 'dist' / name).read_bytes()
    if hashlib.sha256(data).hexdigest() != expected:
        raise ValueError(f'Browser file does not match release: {name}')
for path in web.rglob('*'):
    if path.is_file() and '.git' not in path.parts and forbidden.search(path.name):
        raise ValueError(f'Installer or signing material is not allowed: {path.name}')

site = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else web.parent / '_site'
site.mkdir(parents=True, exist_ok=True)
if any(site.iterdir()):
    raise ValueError('The staging directory must be empty')
for name in files:
    target = site / name
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(web / 'dist' / name, target)
print(f"Verified and staged {len(files)} browser files for {manifest['version']}; no installers or signing files")
