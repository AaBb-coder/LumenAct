// Static local assets used by the single-face reference page.
function cleanPath(value) {
  const path = String(value).replaceAll('\\', '/').replace(/^\.\//, '');
  if (!path || path.startsWith('/') || path.split('/').some(part => part === '..' || part === '') ||
      /^[a-z][a-z0-9+.-]*:/i.test(path)) throw new Error('资源必须位于参考脸部目录中');
  return path;
}
async function binaryData(blob, name) {
  if (!name.endsWith('.json')) return blob.arrayBuffer();
  const value = JSON.parse(await blob.text());
  if (value.schema !== 'lumen.geometry.buffer.v1' || value.encoding !== 'base64')
    throw new Error('不支持的几何包装格式');
  const text = atob(value.data), bytes = Uint8Array.from(text, char => char.charCodeAt(0));
  if (bytes.byteLength !== value.byte_length) throw new Error('几何数据长度不匹配');
  return bytes.buffer;
}
export function httpAssets(root) {
  const base = new URL(root, location.href);
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  let geometry = 'geometry.buffer.json';
  const read = async name => {
    const path = cleanPath(name);
    const url = new URL(path.split('/').map(encodeURIComponent).join('/'), base);
    const response = await fetch(url);
    if (!response.ok) throw new Error('缺少脸部参考资源：' + path);
    return response.blob();
  };
  return {
    setGeometry(name) { geometry = cleanPath(name); },
    async json(name) { return JSON.parse(await (await read(name)).text()); },
    async binary(name) { const path = name === 'geometry' ? geometry : cleanPath(name); return binaryData(await read(path), path); },
    blob(name) { return read(name); },
  };
}
