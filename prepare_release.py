"""Build allowlisted source, Hugging Face resource, and full-preview archives."""
import argparse
import json
from pathlib import Path
import tempfile
from zipfile import ZipFile, ZIP_DEFLATED

from download_assets import ROOT, asset_issues, checked_path, load_manifest


def write_archive(destination, root, files, extras=None):
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=destination.parent, prefix=destination.name + '.', suffix='.part', delete=False) as output:
            temporary = Path(output.name)
        with ZipFile(temporary, 'w', compression=ZIP_DEFLATED, compresslevel=6) as archive:
            for source, name in files:
                archive.write(checked_path(root, source), name)
            for name, content in (extras or {}).items():
                archive.writestr(name, content)
        temporary.replace(destination)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description='Prepare local release archives; does not upload anything')
    parser.add_argument('--output-dir', type=Path, default=ROOT.parent)
    parser.add_argument('--source-only', action='store_true', help='Build only GitHub source; assets need not be installed')
    args = parser.parse_args()
    manifest = load_manifest(ROOT)
    names = manifest['release_files']
    if len(set(names)) != len(names):
        raise SystemExit('Duplicate file in release manifest')
    assets = set(manifest['artifacts'])
    if not assets.issubset(names):
        raise SystemExit('Some assets are missing from release_files')
    source = [name for name in names if name not in assets]
    required = source if args.source_only else names
    for name in required:
        if not checked_path(ROOT, name).is_file():
            raise SystemExit('Missing release file: ' + name)
    if not args.source_only:
        issues = asset_issues(ROOT, manifest['artifacts'])
        if issues:
            raise SystemExit('Assets differ from the release manifest; run download_assets.py --check')
    output = args.output_dir.resolve()
    output.mkdir(parents=True, exist_ok=True)
    write_archive(output / 'lumenact-local-preview-source.zip', ROOT, [(name, name) for name in source])
    if not args.source_only:
        resource_files = [(name, name) for name in names if name in assets]
        resource_files.extend([
            ('docs/HUGGINGFACE_CARD.md', 'README.md'),
            ('models/ASSET_NOTICE.md', 'models/ASSET_NOTICE.md'),
            ('assets/reference-face/ASSET_NOTICE.md', 'assets/reference-face/ASSET_NOTICE.md'),
            ('docs/ADAPTING_YOUR_MODEL.md', 'docs/ADAPTING_YOUR_MODEL.md'),
            ('docs/FORMAT.md', 'docs/FORMAT.md'),
        ])
        resource_files.extend((name, name) for name in manifest['distribution']['resource_license']['license_files'])
        asset_manifest = {'schema': 'lumenact.assets.v1', 'artifacts': manifest['artifacts'],
                          'resource_license': manifest['distribution']['resource_license']}
        write_archive(output / 'lumenact-local-preview-huggingface.zip', ROOT, resource_files,
                      {'asset-manifest.json': json.dumps(asset_manifest, ensure_ascii=False, indent=2) + '\n'})
        write_archive(output / 'lumenact-local-preview.zip', ROOT, [(name, name) for name in names])
    print('Prepared allowlisted release archives in ' + str(output))


if __name__ == '__main__':
    main()
