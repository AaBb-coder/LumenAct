# 本地接口与扩展

服务仅绑定 `127.0.0.1`。以下路径相对当前预览服务。

## GET /api/health

返回语义模型的 `ready`、`error`、`model` 和 `device`。模型缺少依赖时返回明确错误，静态参考预览仍可用。

## POST /api/semantic

```json
{"intent": "开心地打招呼", "text": "早上好！"}
```

返回 `expression`、`confidence`、`context_id`、`context_name`、`speech_style`、`top_labels`、`elapsed_ms` 及模型名称。耗时是一次语义选择处理时间，不包括 LLM、TTS、首轮权重加载或动画播放。

参考客户端按类别与可用上下文选择固定片段。输出不是连续面部控制值，也不是下一帧预测。

## 用户服务代理

`POST /api/services/chat`：

```json
{
  "endpoint": "https://example.com/v1/chat/completions",
  "model": "your-model",
  "key": "your-key",
  "messages": [{"role": "user", "content": "你好"}]
}
```

`POST /api/services/speech`：

```json
{
  "endpoint": "https://example.com/v1/audio/speech",
  "model": "your-tts-model",
  "voice": "your-voice",
  "key": "your-key",
  "text": "你好"
}
```

chat 返回服务商 JSON；speech 返回服务商音频。服务端不保存这些请求，不自带任何账号或服务器配置。

## 网页控制

```js
await window.lumenReference.selectExpression('开心', '早上好');
window.lumenReference.chooseClip('0');
window.lumenReference.setShapes({mouth_a: 50, eyebrow_up_L: 30});
window.lumenReference.clearOverrides();
```

`setShapes` 使用已加载模型的实际形态键名称，数值为 0–100，手动覆盖持续到清除或选择其他片段。它只应用输入值，不生成动作。外部系统可以自行决定这些值如何计算。
