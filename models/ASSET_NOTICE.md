# 模型及表演数据授权

本声明按资源分别说明许可。预览器代码的 MIT 许可证不自动覆盖模型、分词器或表演数据。

## 语义模型与分词器

`models/semantic/` 包含 RBT3-Lumen-38M-v6 的权重、配置和配套分词器。RBT3-Lumen-38M-v6 由 **B站 Lumen_流明_** 自行训练，不是从第三方模型权重直接再分发的副本。语义权重和本项目配套配置按 Apache License 2.0 发布，全文见 [Apache-2.0.txt](../licenses/Apache-2.0.txt)。

分词器作为该语义模型的配套预处理文件一并发布。若后续版本更换为第三方词表或 tokenizer，应在对应版本补充其上游署名和许可证；本声明不扩大任何第三方组件原本的许可范围。

## 表演曲线与标签资料

对于项目有权授权的 `models/expression/catalog.json`、`models/expression/curves.f32` 中的表演数据与资料，采用 Creative Commons Attribution 4.0 International（CC BY 4.0）。

在许可范围内，允许复制、修改、再分发和商业使用。使用或分发时，请保留已有的作者与来源信息，注明“表演数据来源：LumenAct／流明表情工坊”，附上项目实际发布页与 [CC BY 4.0 许可链接](https://creativecommons.org/licenses/by/4.0/)，并说明是否做过修改。不得暗示项目或原作者为使用者及其作品背书。完整文本见 [CC-BY-4.0.txt](../licenses/CC-BY-4.0.txt)。

本许可仅覆盖项目有权授权的内容，不授予第三方角色网格、纹理、完整流明角色、项目标识或私有工程的权利。若存在第三方原有署名或许可要求，应同时保留并遵守。

## 参考脸单独授权

流明参考脸采用独立的非商用许可，见 [参考脸声明](../assets/reference-face/ASSET_NOTICE.md)。表演数据可商用，不等于流明参考脸可商用。
