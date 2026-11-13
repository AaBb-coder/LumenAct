// Public reference controls, implemented independently of the private runtime.
const browActions = new Map([
  ['右眉上挑', {channel: 'eyebrow_up_R', label: '右眉上挑'}],
  ['左眉上挑', {channel: 'eyebrow_up_L', label: '左眉上挑'}],
  ['单独抬起右眉', {channel: 'eyebrow_up_R', label: '右眉上挑'}],
  ['单独抬起左眉', {channel: 'eyebrow_up_L', label: '左眉上挑'}],
]);

export function buildChatPrompt(catalog) {
  const labels = [...new Set(catalog?.labels || catalog?.styles?.map(style => style.label) || [])];
  return `你是流明（Lumen），正在 LumenAct 本地网页中与用户对话的虚拟角色。网页展示的脸就是你的虚拟脸部；你输出的括号标签会由网页执行，驱动这张脸。
用简短、自然的中文回应用户。对虚拟脸部的表情请求，不要回答“没有实体眉毛”“只能用文字或 emoji 表演”；也不要声称你有现实中的肉体。
每次只输出一条回复，格式为：(标签)台词。标签必须放在句首，只用一对括号，台词中不要再写括号动作或 emoji。
整体情绪标签只能从以下列表选择：${labels.join('、')}。
另有两个独立的基础动作标签：右眉上挑、左眉上挑。左右均以角色自身为准。
当用户要求单独抬起、轻挑或上挑右侧眉毛时，必须输出：(右眉上挑)好，这样呢？
当用户要求单独抬起、轻挑或上挑左侧眉毛时，必须输出：(左眉上挑)好，这样呢？
单眉请求不要换成“挑眉逗趣”等整体情绪，否则会牵动整张脸。只使用上述已支持的标签；其他精确部位动作尚未提供，应说明当前限制，不要假称已经执行。`;
}

export function browDirective(intent) {
  return browActions.get(String(intent).trim()) || null;
}

const smooth = value => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };

// A fixed single-channel demonstration, not a learned semantic-model output.
export function createBrowControl() {
  let action = null;
  function weight() {
    if (!action) return 0;
    if (action.release !== null) return action.releaseWeight * (1 - smooth(action.release / .4));
    return smooth(action.elapsed / .25) * (1 - smooth((action.elapsed - 1.35) / .4));
  }
  return {
    get label() { return action?.label || ''; },
    start(directive, baseline) {
      const targets = Object.fromEntries(Object.entries(baseline).filter(([name]) => name.startsWith('eyebrow_')));
      targets[directive.channel] = Math.max(70, Number(targets[directive.channel]) || 0);
      action = {...directive, targets, elapsed: 0, release: null, releaseWeight: 0};
    },
    release() {
      if (action && action.release === null) {
        action.releaseWeight = weight(); action.release = 0;
      }
    },
    tick(dt) {
      if (!action) return;
      const elapsed = Number.isFinite(dt) ? Math.max(0, dt) : 0;
      if (action.release !== null) action.release += elapsed;
      else action.elapsed += elapsed;
      if ((action.release !== null && action.release >= .4) || action.elapsed >= 1.75) action = null;
    },
    compose(baseline) {
      if (!action) return baseline;
      const output = {...baseline}, amount = weight();
      for (const [name, target] of Object.entries(action.targets)) {
        const value = Number(baseline[name]) || 0;
        output[name] = value + (target - value) * amount;
      }
      return output;
    },
  };
}
