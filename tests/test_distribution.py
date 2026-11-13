"""Release-boundary and interrupted-download regression checks; no external network."""
from contextlib import redirect_stdout
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import io
import json
from pathlib import Path
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch
from zipfile import ZipFile

import download_assets
import prepare_release

PAYLOAD = b'public-reference-resource'
SPEC = {'bytes': len(PAYLOAD), 'sha256': hashlib.sha256(PAYLOAD).hexdigest()}


class ResponseHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        body = PAYLOAD if self.path == '/good' else (b'x' * len(PAYLOAD) if self.path == '/corrupt' else PAYLOAD[:4])
        self.send_response(200)
        self.send_header('Content-Length', str(len(PAYLOAD)))
        self.end_headers()
        self.wfile.write(body)
        self.close_connection = True

    def log_message(self, *args):
        pass


class DownloadTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), ResponseHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = 'http://127.0.0.1:' + str(cls.server.server_port)

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def test_verified_download_replaces_existing_file(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'asset.bin'
            target.write_bytes(b'previous-file')
            download_assets.download_atomic(self.url + '/good', target, SPEC)
            self.assertEqual(target.read_bytes(), PAYLOAD)
            self.assertEqual(list(Path(directory).glob('*.part')), [])

    def test_corruption_and_interruption_preserve_existing_file(self):
        for route in ['/corrupt', '/short']:
            with self.subTest(route=route), tempfile.TemporaryDirectory() as directory:
                target = Path(directory) / 'asset.bin'
                target.write_bytes(b'previous-file')
                with self.assertRaises(ValueError):
                    download_assets.download_atomic(self.url + route, target, SPEC)
                self.assertEqual(target.read_bytes(), b'previous-file')
                self.assertEqual(list(Path(directory).glob('*.part')), [])

    def test_offline_check_detects_same_size_corruption_and_missing_assets(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            name = 'models/semantic/selector.onnx'
            path = download_assets.checked_path(root, name)
            path.parent.mkdir(parents=True)
            path.write_bytes(b'x' * len(PAYLOAD))
            artifacts = {name: SPEC, 'models/expression/curves.f32': SPEC}
            self.assertEqual(download_assets.asset_issues(root, artifacts),
                             [(name, 'checksum mismatch'), ('models/expression/curves.f32', 'missing')])

    def test_asset_paths_cannot_escape_package(self):
        with tempfile.TemporaryDirectory() as directory:
            for name in ['../outside.bin', '/outside.bin', 'C:/outside.bin', 'models\\outside.bin']:
                with self.subTest(name=name), self.assertRaises(ValueError):
                    download_assets.checked_path(Path(directory), name)


class SourceArchiveTests(unittest.TestCase):
    def test_source_archive_excludes_payload_and_unlisted_private_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'package'
            root.mkdir()
            payload_name = 'models/semantic/selector.onnx'
            payload = download_assets.checked_path(root, payload_name)
            payload.parent.mkdir(parents=True)
            payload.write_bytes(PAYLOAD)
            (root / 'README.md').write_text('Public documentation', encoding='utf-8')
            (root / '.env').write_text('PRIVATE_TEST_MARKER=do-not-package', encoding='utf-8')
            manifest = {'artifacts': {payload_name: SPEC},
                        'release_files': ['README.md', 'release-manifest.json', payload_name]}
            (root / 'release-manifest.json').write_text(json.dumps(manifest), encoding='utf-8')
            output = Path(directory) / 'output'
            with patch.object(prepare_release, 'ROOT', root), patch.object(sys, 'argv',
                    ['prepare_release.py', '--source-only', '--output-dir', str(output)]), redirect_stdout(io.StringIO()):
                prepare_release.main()
            with ZipFile(output / 'lumenact-local-preview-source.zip') as archive:
                self.assertEqual(set(archive.namelist()), {'README.md', 'release-manifest.json'})


if __name__ == '__main__':
    unittest.main()
