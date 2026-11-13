import {createReferenceView} from './reference-view.js?v=gaze-sync-9';
import {httpAssets} from './assets.js?v=workbench-4';
import {loadCurvePlayer} from './curve-player.js?v=gaze-neutral-8';
import {buildChatPrompt, browDirective, createBrowControl} from './chat-director.js?v=face-directives-10';

const $ = id => document.getElementById(id);
const settingsKey = 'lumenact-reference-services-v2';
let face = null, player = null, last = 0, audio = null, audioUrl = null;
let displayedStyleId = null;
const history = [];
const brows = createBrowControl();
let hasSavedTtsSetting = false;
const say = (text, kind = '') => { $('faceStatus').textContent = text; $('faceStatus').dataset.kind = kind; };

async function api(path, body) {
  const response = await fetch('/api/' + path, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
  if (path.endsWith('/speech') && response.ok) return response.blob();
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(value.error || '本地接口请求失败');
  return value;
}
function shapes() { return brows.compose(player ? player.sample() : {}); }
function updateFace() { if (face) face.setShapes(shapes()); }
function updateTelemetry() {
  if (!face || !player) return;
  const values = shapes();
  const active = Object.values(values).filter(value => Math.abs(Number(value) || 0) > 2).length;
  const total = face.channels?.length || 166;
  const activeNode = $('activeChannels'), channelNode = $('channelValue'), bar = $('channelBar');
  if (activeNode) activeNode.textContent = String(active);
  if (channelNode) channelNode.textContent = active + ' / ' + total;
  if (bar) bar.style.setProperty('--w', Math.min(100, active / Math.max(1, total) * 100).toFixed(1) + '%');
  const fps = $('fps'), latency = $('latency');
  if (fps) fps.textContent = '60';
  if (latency) latency.textContent = '16 ms';
}
function pickStyle(style) {
  if (!player) return;
  brows.release();
  player.choose(style.id); updateFace();
  $('currentExpression').textContent = style.label;
  displayedStyleId = style.id;
  say('表情已更新', 'ok');
}
function showSemantic(result) {
  $('semanticTime').textContent = result.elapsed_ms.toFixed(2) + ' ms';
  $('semanticTime').title = '';
}
async function selectExpression(intent, text = '') {
  const directive = browDirective(intent);
  if (directive) {
    if (!player || !face?.channels.some(channel => channel.name === directive.channel))
      throw new Error('当前脸部没有可用的单眉通道');
    player.returnToNeutral();
    brows.start(directive, player.sample());
    $('semanticTime').textContent = '—';
    $('semanticTime').title = '基础单眉指令直接控制公开形态键，本次未调用语义模型';
    return {operation: 'reference_brow_control', expression: directive.label};
  }
  const result = await api('semantic', {intent, text});
  showSemantic(result);
  const options = player.catalog.styles.filter(style => style.label === result.expression);
  const match = options.find(style => result.context_id !== 'auto' && style.context_id === result.context_id) || options[0];
  if (!match) throw new Error('当前无法显示该表情：' + result.expression);
  pickStyle(match); return result;
}
function addMessage(text, role = 'assistant') {
  const item = document.createElement('div'); item.className = 'message ' + role; item.textContent = text;
  $('messages').append(item); $('messages').scrollTop = $('messages').scrollHeight;
}
function spokenText(text) { return text.replace(/[（(][^（）()\n]*[）)]/g, '').trim(); }
function settings() {
  return Object.fromEntries(['llmEndpoint','llmModel','llmKey','ttsEndpoint','ttsModel','ttsVoice','ttsKey'].map(id => [id, $(id).value.trim()]));
}
function restoreSettings() {
  try {
    const value = JSON.parse(localStorage.getItem(settingsKey) || '{}');
    for (const [id, text] of Object.entries(value)) if ($(id) && typeof text === 'string') $(id).value = text;
    $('rememberKeys').checked = !!(value.llmKey || value.ttsKey);
    if (typeof value.ttsEnabled === 'boolean') {
      $('ttsEnabled').checked = value.ttsEnabled;
      hasSavedTtsSetting = true;
    }
  } catch {}
}
async function loadServiceDefaults() {
  try {
    const response = await fetch('/api/services/config');
    if (!response.ok) return;
    const value = await response.json();
    for (const id of ['llmEndpoint', 'llmModel', 'ttsEndpoint', 'ttsModel', 'ttsVoice']) {
      if (!$(id).value.trim() && typeof value[id] === 'string') $(id).value = value[id];
    }
    if (!hasSavedTtsSetting && typeof value.ttsEnabled === 'boolean') $('ttsEnabled').checked = value.ttsEnabled;
  } catch {}
}
async function health() {
  try {
    const response = await fetch('/api/health'); if (!response.ok) throw new Error('请通过 start_preview 启动预览');
    const value = await response.json();
    $('semanticStatus').textContent = value.ready ? '本地 CPU · READY' : value.error ? '语义模型未就绪' : '本地模型预热中';
    $('semanticStatus').dataset.kind = value.ready ? 'ok' : value.error ? 'error' : '';
    $('semanticStatus').title = value.error || value.model;
    if (!value.ready && !value.error) setTimeout(health, 1800);
  } catch (error) { $('semanticStatus').textContent = '语义接口不可用'; $('semanticStatus').dataset.kind = 'error'; $('semanticStatus').title = error.message; }
}
function bind() {
  for (const button of document.querySelectorAll('[data-view]')) button.onclick = () => face?.setView(button.dataset.view);
  $('resetView').onclick = () => face?.setView('front');
  $('saveServices').onclick = () => {
    const value = settings(); if (!$('rememberKeys').checked) { delete value.llmKey; delete value.ttsKey; }
    value.ttsEnabled = $('ttsEnabled').checked;
    try { localStorage.setItem(settingsKey, JSON.stringify(value)); say('配置已保存在此浏览器', 'ok'); }
    catch { say('浏览器不允许保存配置', 'error'); }
  };
  $('chatForm').onsubmit = async event => {
    event.preventDefault(); const text = $('chatInput').value.trim(); if (!text) return;
    if (audio) { audio.onended = null; audio.pause(); }
    brows.release();
    player?.returnToNeutral();
    $('chatInput').value = ''; $('sendChat').disabled = true; addMessage(text, 'user');
    try {
      const config = settings();
      const messages = [{role: 'system', content: buildChatPrompt(player?.catalog)}, ...history.slice(-12), {role: 'user', content: text}];
      const value = await api('services/chat', {endpoint: config.llmEndpoint, key: config.llmKey, model: config.llmModel, messages});
      const answer = value.choices?.[0]?.message?.content ?? value.output_text ?? value.text;
      if (typeof answer !== 'string' || !answer.trim()) throw new Error('LLM 没有返回文本回复');
      $('rawAnswer').textContent = answer; addMessage(spokenText(answer) || answer);
      history.push({role: 'user', content: text}, {role: 'assistant', content: answer});
      const intent = /[（(]([^（）()\n]+)[）)]/.exec(answer)?.[1];
      if (intent) try { await selectExpression(intent, spokenText(answer)); } catch (error) { addMessage('表情响应：' + error.message, 'error'); }
      if ($('ttsEnabled').checked) {
        const blob = await api('services/speech', {endpoint: config.ttsEndpoint, key: config.ttsKey, model: config.ttsModel, voice: config.ttsVoice, text: spokenText(answer) || answer});
        audio?.pause(); if (audioUrl) URL.revokeObjectURL(audioUrl); audioUrl = URL.createObjectURL(blob);
        const speechAudio = new Audio(audioUrl); audio = speechAudio;
        speechAudio.onended = () => { if (audio === speechAudio) { brows.release(); player?.returnToNeutral(); } };
        await speechAudio.play();
      }
    } catch (error) { brows.release(); player?.returnToNeutral(); addMessage(error.message, 'error'); }
    finally { $('sendChat').disabled = false; }
  };
}
function frame(now) {
  const dt = last ? Math.min(.1, (now - last) / 1000) : 0; last = now;
  player?.tick(dt); brows.tick(dt); updateFace();
  const displayId = brows.label ? 'brow:' + brows.label : player?.style.id;
  if (player && displayedStyleId !== displayId) {
    displayedStyleId = displayId;
    $('currentExpression').textContent = brows.label || player.style.label;
    say(brows.label ? '单眉动作' : '自然放松', 'ok');
  }
  updateTelemetry();
  requestAnimationFrame(frame);
}
async function load() {
  try {
    const assets = httpAssets('../assets/reference-face/');
    const reference = await assets.json('reference.json'); assets.setGeometry(reference.geometry);
    const manifest = await assets.json(reference.avatar);
    face = await createReferenceView({container: $('preview'), manifest, assets});
    say('脸部已就绪', 'ok');
    const curve = await loadCurvePlayer('../models/expression/');
    player = curve;
    $('curveMeta').textContent = player.catalog.fps.toFixed(0) + ' Hz';
    pickStyle(player.catalog.styles.find(style => style.id === player.catalog.neutral_style) || player.catalog.styles[0]);
  } catch (error) { say(error.message, 'error'); $('runtimeStatus').textContent = '资源加载失败'; }
}
restoreSettings(); bind(); loadServiceDefaults(); requestAnimationFrame(frame); health(); load();
window.lumenReference = {selectExpression};
