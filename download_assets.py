"""Fetch the public reference assets; Python standard library only."""
import argparse
import hashlib
from http.client import HTTPException
import json
from pathlib import Path, PurePosixPath
import re
import sys
import tempfile
from urllib.parse import quote
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
ASSET_PREFIXES = ('models/semantic/', 'models/expression/', 'assets/reference-face/')


def checked_path(root, relative):
    path = PurePosixPath(relative)
    if not relative or '\\' in relative or ':' in relative or path.is_absolute() or '..' in path.parts:
        raise ValueError('Invalid package path: ' + relative)
    target = root.joinpath(*path.parts)
    if not target.resolve().is_relative_to(root.resolve()):
        raise ValueError('Package path escapes its root: ' + relative)
    return target


def load_manifest(root=ROOT):
    manifest = json.loads((root / 'release-manifest.json').read_text(encoding='utf-8-sig'))
    artifacts = manifest.get('artifacts', {})
    if not artifacts:
        raise ValueError('The release manifest contains no asset checksums')
    for relative, spec in artifacts.items():
        checked_path(root, relative)
        if not relative.startswith(ASSET_PREFIXES):
            raise ValueError('Asset is outside the public resource directories: ' + relative)
        if not re.fullmatch(r'[0-9a-f]{64}', spec.get('sha256', '')):
            raise ValueError('Invalid SHA-256: ' + relative)
        if type(spec.get('bytes')) is not int or spec['bytes'] < 1:
            raise ValueError('Invalid asset size: ' + relative)
    return manifest


def digest_file(path):
    digest = hashlib.sha256()
    with path.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def asset_issues(root, artifacts, verify_hash=True):
    issues = []
    for relative, spec in artifacts.items():
        path = checked_path(root, relative)
        if not path.is_file():
            issues.append((relative, 'missing'))
        elif path.stat().st_size != spec['bytes']:
            issues.append((relative, 'size mismatch'))
        elif verify_hash and digest_file(path) != spec['sha256']:
            issues.append((relative, 'checksum mismatch'))
    return issues


def download_atomic(url, target, spec):
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        digest, size = hashlib.sha256(), 0
        request = Request(url, headers={'User-Agent': 'LumenAct-local-preview/1'})
        with urlopen(request, timeout=60) as response:
            with tempfile.NamedTemporaryFile(dir=target.parent, prefix=target.name + '.', suffix='.part', delete=False) as output:
                temporary = Path(output.name)
                for chunk in iter(lambda: response.read(1024 * 1024), b''):
                    size += len(chunk)
                    if size > spec['bytes']:
                        raise ValueError('Downloaded file exceeds its declared size')
                    digest.update(chunk)
                    output.write(chunk)
        if size != spec['bytes'] or digest.hexdigest() != spec['sha256']:
            raise ValueError('Downloaded file does not match this release; existing file was preserved')
        temporary.replace(target)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description='Download and verify public LumenAct assets from Hugging Face')
    parser.add_argument('--repo', help='Public Hugging Face model repository, e.g. OWNER/LumenAct-assets')
    parser.add_argument('--revision', help='Repository commit or tag; a commit is recommended')
    parser.add_argument('--check', action='store_true', help='Verify local sizes and SHA-256 without network access')
    args = parser.parse_args()
    try:
        manifest = load_manifest(ROOT)
        issues = asset_issues(ROOT, manifest['artifacts'])
        if not issues:
            print('All public assets are present and verified. You can start the preview.')
            return 0
        if args.check:
            for relative, reason in issues:
                print(f'{reason}: {relative}')
            return 1
        source = manifest.get('distribution', {}).get('huggingface', {})
        repo = args.repo or source.get('repo_id', '')
        revision = args.revision or source.get('revision', '')
        if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', repo):
            parser.error('Supply --repo OWNER/REPOSITORY; the public repository has not been configured in this candidate.')
        if not revision:
            parser.error('Supply --revision COMMIT_OR_TAG for the matching asset release.')
        for index, (relative, _) in enumerate(issues, 1):
            print(f'[{index}/{len(issues)}] {relative}', flush=True)
            url = f'https://huggingface.co/{repo}/resolve/{quote(revision, safe="")}/{quote(relative, safe="/")}'
            download_atomic(url, checked_path(ROOT, relative), manifest['artifacts'][relative])
        print('Assets downloaded and verified. You can start the preview.')
        return 0
    except (OSError, ValueError, HTTPException) as exc:
        print('Asset setup failed: ' + str(exc), file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
