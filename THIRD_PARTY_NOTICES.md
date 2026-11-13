# 第三方与资源声明

## Three.js

`preview/three.module.js` 是 Three.js 的本地模块，保留其源码中的版权和 MIT 许可声明。

本地版本为 r160。Copyright 2010-2023 Three.js Authors.
完整 MIT 许可见 [licenses/three-MIT.txt](licenses/three-MIT.txt)，源码中的原声明保持不变。

## 本地推理依赖

NumPy、ONNX Runtime 和 Hugging Face Tokenizers 通过 requirements.txt 由用户安装，各自的许可证及依赖声明适用；本包不复制开发机上的 Python 依赖目录。

## 模型与脸部

语义模型属于 RBT3-Lumen-38M-v6 派生权重，目标发布许可选为 Apache-2.0。上游模型与分词器的具体来源、许可和声明仍待核实，完成前不据此授予派生权重新的对外许可；不能以预览器的 MIT 许可证或项目自己的选择替代上游许可。

项目有权授权的表演数据采用 CC BY 4.0，参考脸采用 CC BY-NC 4.0，分别见 models/ASSET_NOTICE.md 和 assets/reference-face/ASSET_NOTICE.md。正式分发前需核对素材原有许可；这里只授权相关权利人有权授权的部分，不声称流明完整角色、Unity 工程或其他角色模型已获公开授权。
