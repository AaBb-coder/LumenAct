# 分仓发布

所有操作限定在 `lumenact-local-preview` 目录。工具只生成本地候选包，不创建仓库，也不上传。

## 发布位置

| 文件 | 目的地 |
| --- | --- |
| `lumenact-local-preview-source.zip` 解压后的内容 | GitHub 源码仓库 |
| `lumenact-local-preview-huggingface.zip` 解压后的内容 | Hugging Face 模型资源仓库 |
| `lumenact-local-preview.zip` | GitHub Releases 的完整即用附件 |

Hugging Face 资源包已把 `docs/HUGGINGFACE_CARD.md` 放到根目录 `README.md`，并包含资源哈希和各自的授权说明。不要只上传 ZIP 而缺少展开的资源路径，否则下载脚本无法按路径取得文件。

## 发布前准备

1. 已选择代码 MIT、语义派生权重目标 Apache-2.0、表演数据 CC BY 4.0、参考脸 CC BY-NC 4.0。正式分发前需完成上游基础模型、分词器及参考脸素材的许可核对，补充必要原始声明；尤其不要把语义权重当前的目标许可写成已完成授权。各项范围见 `models/ASSET_NOTICE.md`、`assets/reference-face/ASSET_NOTICE.md` 和发布清单。
2. 在 `release-manifest.json` 的 `distribution.huggingface.repo_id` 填写实际公开仓库 `OWNER/REPOSITORY`。上传资源后，把匹配的提交或标签写入 `revision`；发布版本建议使用不可变的提交哈希。
3. 如果资源发生变化，更新对应 `artifacts` 的字节数和 SHA-256，并与源码版本一起发布。下载器有意拒绝不同版本或损坏的资源，不会自行更新哈希。
4. 执行 `python prepare_release.py`，在包目录的上一级生成三个 ZIP。只有源码时可用 `python prepare_release.py --source-only`。

## GitHub 范围

源码包采用 `release-manifest.json` 的显式清单，排除 `artifacts` 中的资源载荷。保留资源授权说明和格式文档，包含 `preview/chat-director.js`、下载与打包工具。

`.gitignore` 也已排除资源目录中的载荷、压缩包、临时下载、常见本地服务配置及密钥文件。忽略规则不会把已经跟踪的文件移出 Git；如果已有仓库跟踪了资源，需先审查暂存区，再单独处理这些跟踪项。不要把整个工作区或上级目录加入仓库。

## 下载与启动

源码用户执行：

```sh
python download_assets.py --repo OWNER/REPOSITORY --revision COMMIT_OR_TAG
python download_assets.py --check
```

Windows 也可使用 `download_assets.bat --repo OWNER/REPOSITORY --revision COMMIT_OR_TAG`，macOS / Linux 使用 `sh download_assets.sh` 并传入相同参数。配置好清单中的公开仓库与版本后，可省略这两个参数。下载器只依赖 Python 标准库，面向公开仓库，不使用开发机密钥。

下载器跳过校验通过的文件；损坏或缺失的文件会下载到临时文件，大小和 SHA-256 通过后才替换目标。网络中断或校验失败不会覆盖原文件，重新运行即可重试该文件。`--check` 不访问网络。

完整包已经包含资源，可直接启动；从源码启动时若资源缺失，本地服务会提示下载命令。

## 当前候选状态

分项许可方案已由项目方确认。GitHub 源码仓库为 `AaBb-coder/LumenAct`，Hugging Face 资源仓库为 `AaBbcoder/LumenAct`，当前资源版本为 `df8126a2a854735227ec81b7f12ab62d49a6d989`。源码和资源均已上传；后续新增资源时应更新发布清单、SHA-256 和固定版本。

当前仅更新本地目录及文档，按项目方要求暂不重新打包。已有 ZIP 不包含这次的许可和教程修改，继续编辑时以目录内容为准，确定发布后再执行打包工具。
