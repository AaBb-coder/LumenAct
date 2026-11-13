# 包内资源格式与 Blender 适配参考

本包的网页只加载 `assets/reference-face/` 中的唯一流明脸部。网页没有自定义模型导入入口；本文件用于需要在 Blender 中适配自己角色的使用者，说明公开资源的含义。

## 流明脸部参考

目录包含：

```text
assets/reference-face/
  reference.json
  avatar.json
  geometry.buffer.json
  face_texture_0.png
  channels.json
```

- `avatar.json`：脸部节点、静态绑定、网格、材质、纹理引用和形态键。
- `geometry.buffer.json`：几何属性的 base64 包装。
- `channels.json`：112 个可调脸部形态键的名称、分组和默认值。
- `reference.json`：预览器使用的脸部入口和校准示例说明。

形态键名称是适配时最重要的公共接口。使用者在 Blender 中通过 MCP 让 AI 分析资源仓库提供的带形态键流明参考脸和目标角色，保留目标原有键后类比制作准确同名键，再通过自行生成的双模型联动面板人工比较修正。参考脸的自定义 JSON 不能被 Blender 原生导入；`lumen-reference-face.blend` 用于 Blender 适配，网页 JSON 只用于网页预览。

## Blender 适配建议

推荐 VRM 人形角色，但格式不限于 VRM。FBX、MMD（PMX／PMD）、glTF／GLB 或 Blender 文件均可作为适配来源，核心接口是适配后可按名称和权重驱动的形态键网格。不同格式需使用对应导入方式；骨骼、材质或组合 Morph 不能直接等同于顶点形态键。基础形态键驱动不要求 Humanoid 骨架。

1. 准备 Blender MCP 和可导入的带形态键参考脸，把参考脸与目标角色放进同一场景，保存原始备份。
2. 保留目标已有形态键、相对键关系、默认值和绑定；让 AI 识别对应部位，按 `channels.json` 制定通道适配表。
3. 类比参考键的实际顶点变化，为目标建立或复用同名键；不同拓扑不直接按顶点编号复制位移。
4. 让 AI 为当前场景生成联动面板，用相同权重同步驱动两边的对应键，人工逐项检查、修正并记录，再检查组合效果。
5. 保留形态键导出，在自己的运行时中匹配通道，并把曲线的 0–100 换算为所需范围，例如 Blender 常用的 0–1。

教程中的 AI 辅助面板由使用者自行生成。本包不内置 Blender 校准插件、自动形态键转移、拓扑匹配、权重生成、角色导出器或网页校准工具。

逐步制作、组合检查与导出注意事项见 [Blender 适配教程](ADAPTING_YOUR_MODEL.md)。

## 表演曲线

本包的表演数据独立于语义 ONNX 保存。发布构建从现有 v1.2 的 `layered.f32` 按片段范围复制控制曲线，写入 `curves.f32`；这一过程没有运行 ONNX 来生成或提取动画。

本地运行链路是：中文描述 → `selector.onnx` 输出情绪及上下文分类 → 匹配曲线目录 → 基础播放器采样、插值并写入脸部形态键。这版参考包没有单独的表情生成 ONNX。主界面隐藏片段目录、内部名称和手动播放控制；曲线数据及其格式仍随包公开。

`models/expression/catalog.json` 是 `lumenact.curves.v1`：

- `fps`：原曲线采样率。
- `channel_count`、`channels`：166 维控制列及每列含义。
- `curves`：float32 小端二进制文件，按 `[frame][channel]` 排列。
- `styles`：每段的 id、label、context_id、offset、frames 等公开字段。
- `offset` 单位为整帧；地址为 `((offset + frame) * channel_count + channel_index) * 4`。
- `neutral_style`：素材中的自然类别片段编号。

其中 `kind=blendshape` 的列可直接按名称映射到 Blender shape keys。其他肌肉/骨骼列仍作为公开数值数据保存，但单脸网页不求解它们。

## 语义模型

`models/semantic/config.json` 定义语义 ONNX 模型、分词器、最大输入长度和输出目录。输入是一对中文字符串：情绪描述和可选台词。输出包括类别、上下文、语音风格和近似匹配 logits。

这些是学习模型的输入输出定义，不包含主项目的行为调度、口型控制、视线控制、动作图或骨骼求解参数。

