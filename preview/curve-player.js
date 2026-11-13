// Reference playback: source frame sampling and ordinary linear interpolation.
export async function loadCurvePlayer(root) {
  const base = new URL(root, location.href);
  const response = await fetch(new URL('catalog.json', base));
  if (!response.ok) throw new Error('表演曲线目录加载失败');
  const catalog = await response.json();
  const dataResponse = await fetch(new URL(catalog.curves, base));
  if (!dataResponse.ok) throw new Error('表演曲线加载失败');
  const buffer = await dataResponse.arrayBuffer();
  const width = catalog.channel_count;
  if (catalog.schema !== 'lumenact.curves.v1' || !Number.isInteger(width) || width < 1 ||
      buffer.byteLength % (width * 4)) throw new Error('表演曲线布局无效');
  const view = new DataView(buffer);
  const data = new Float32Array(buffer.byteLength / 4);
  for (let i = 0; i < data.length; i++) data[i] = view.getFloat32(i * 4, true);
  for (const style of catalog.styles)
    if (style.offset < 0 || style.frames < 1 || (style.offset + style.frames) * width > data.length)
      throw new Error('片段超出曲线缓冲区');
  const tracks = catalog.channels.filter(channel => channel.kind === 'blendshape')
    .map(channel => ({index: channel.index, name: channel.property.replace(/^blendShape\./, '')}));
  const neutral = catalog.styles.find(style => String(style.id) === String(catalog.neutral_style)) || catalog.styles[0];
  let selected = neutral;
  let position = 0, playing = true, looping = false, interpolate = true;
  let transition = null;
  const fadeSeconds = .4;
  const durationOf = style => Math.max(0, (style.frames - 1) / catalog.fps);
  function readShapes(style, time) {
    const frame = Math.max(0, Math.min(time * catalog.fps, style.frames - 1));
    const start = Math.floor(frame), end = Math.min(start + 1, style.frames - 1);
    const weight = interpolate ? frame - start : 0;
    const shapes = {};
    for (const track of tracks) {
      const a = data[(style.offset + start) * width + track.index];
      const b = data[(style.offset + end) * width + track.index];
      shapes[track.name] = a + (b - a) * weight;
    }
    return shapes;
  }
  function sample() {
    const shapes = readShapes(selected, position);
    if (transition) {
      const t = Math.min(1, transition.elapsed / fadeSeconds);
      const weight = t * t * (3 - 2 * t);
      for (const name of Object.keys(shapes))
        shapes[name] = transition.from[name] + (shapes[name] - transition.from[name]) * weight;
    }
    return shapes;
  }
  function advanceFade(dt) {
    if (transition) {
      transition.elapsed += dt;
      if (transition.elapsed >= fadeSeconds) transition = null;
    }
  }
  function switchTo(style) {
    const from = sample();
    selected = style; position = 0; playing = true;
    transition = {from, elapsed: 0};
  }
  return {
    catalog, sample,
    get style() { return selected; }, get playing() { return playing; },
    get position() { return position; },
    get duration() { return durationOf(selected); },
    get transitioning() { return transition !== null; },
    choose(id) {
      const style = catalog.styles.find(item => item.id === String(id));
      if (!style) throw new Error('找不到表演片段');
      switchTo(style);
    },
    returnToNeutral() {
      looping = false;
      if (selected !== neutral) switchTo(neutral);
      else playing = true;
    },
    tick(dt) {
      if (!playing) return;
      const elapsed = Number.isFinite(dt) ? Math.max(0, dt) : 0;
      const duration = durationOf(selected);
      if (duration <= 0) {
        if (selected !== neutral && !looping) switchTo(neutral);
        advanceFade(elapsed);
        return;
      }
      const untilEnd = Math.max(0, duration - position);
      if (elapsed < untilEnd) { position += elapsed; advanceFade(elapsed); return; }
      position = duration; advanceFade(untilEnd);
      const from = sample(), remaining = elapsed - untilEnd;
      if (selected !== neutral && !looping) selected = neutral;
      const nextDuration = durationOf(selected);
      position = nextDuration > 0 ? remaining % nextDuration : 0;
      transition = {from, elapsed: 0};
      advanceFade(remaining);
    },
    seek(seconds) { position = Math.max(0, Math.min(Number(seconds) || 0, this.duration)); transition = null; },
    play() { if (position >= this.duration) position = 0; playing = true; },
    pause() { playing = false; },
    setLoop(value) { looping = !!value; },
    setInterpolation(value) { interpolate = !!value; },
  };
}
