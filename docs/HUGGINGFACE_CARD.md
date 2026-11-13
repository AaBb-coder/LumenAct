---
license: other
license_name: lumenact-mixed-resource-licenses
license_link: https://huggingface.co/AaBbcoder/LumenAct/blob/main/models/ASSET_NOTICE.md
language:
  - zh
tags:
  - lumenact
  - facial-expression
  - onnx
  - local-inference
---

# LumenAct · 本地表情预览资源

配套源码：[AaBb-coder/LumenAct](https://github.com/AaBb-coder/LumenAct)。本仓库当前作为私有预发布草稿保存，资源来源与许可核对完成前不视为公开发行。

这是供 LumenAct 本地预览器使用的配套资源仓库，不是在线推理服务，也不是可直接通过 Transformers `from_pretrained()` 加载的完整生成模型。

当前为本地发布候选稿，按内容分别授权：项目有权授权的表演数据采用 CC BY 4.0，参考脸采用 CC BY-NC 4.0；语义派生权重拟采用 Apache-2.0，仍待核实上游模型、分词器的来源与许可，暂不视为已完成对外授权。本仓库为混合许可资源集合，不能把所有文件统一视为 Apache 或 MIT。

## 资源结构

- `models/semantic/`：RBT3-Lumen-38M-v6 语义 ONNX、配置和本地分词器。
- `models/expression/`：97 段表演曲线、166 维原始控制列和类别、上下文目录。
- `assets/reference-face/`：流明独立脸部参考几何、形态键、必要绑定及纹理。
- `asset-manifest.json`：资源大小、SHA-256 和授权状态。

当前公开流程由语义模型选择情绪类别与上下文，再读取对应表演曲线。表情部分不是第二个生成 ONNX；网页基础视线、单眉动作与普通播放过渡由独立参考代码实现，不包含主项目的私有运行时。

## 本地使用

下载匹配版本的 GitHub 预览器源码，在源码目录执行：

```sh
python download_assets.py --repo AaBbcoder/LumenAct --revision COMMIT_OR_TAG
```

将 `COMMIT_OR_TAG` 替换为配套资源提交或标签。仓库公开后，上述命令才可用于匿名下载；私有草稿不提供无凭据的下载访问。脚本按源码中的发布清单校验资源，随后通过 `start_preview.bat` 或 `sh start_preview.sh` 启动本地网页。也可手动下载，保持上面的相对目录结构，覆盖到预览器根目录。

模型推理与预览在本地运行；用户自行选择的高层 LLM / TTS 可以是本地或远程服务。角色适配在 Blender 中通过 MCP 由 AI 辅助完成：分析两张脸并类比制作同名形态键，生成双模型联动面板后人工逐项修正，参见 [适配教程](docs/ADAPTING_YOUR_MODEL.md)。面板由使用者自行生成，本包不内置校准插件。此流程需要可直接导入 Blender 的带形态键参考脸，当前包内自定义 JSON 不满足这一导入条件，仍需补充标准参考文件。

适配目标推荐 VRM 人形角色，也可来自 FBX、MMD（PMX／PMD）、glTF／GLB 或 Blender 文件；核心要求是最终具有兼容的形态键通道和权重驱动接口，具体格式的导入与转换由使用者处理。格式来源不限于 VRM，不表示当前网页提供这些格式的通用导入功能。

## 授权

权重和表演数据见 `models/ASSET_NOTICE.md`，参考脸见 `assets/reference-face/ASSET_NOTICE.md`。预览器代码的 MIT 许可证不自动覆盖这些资源；本仓库也不包含或授权完整流明角色及主项目。

除原作者／相关权利人自行使用或另行明确商业授权外，第三方不得将流明参考脸及包含其受保护几何、纹理的改编版本用于商业用途。独立制作、未复制参考脸受保护内容的自有角色，不会仅因使用相同通道或获准的表演数据而受到参考脸的非商用限制。完整标准许可文本附在 `licenses/`。
