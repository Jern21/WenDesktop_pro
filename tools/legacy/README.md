# tools/legacy —— 一次性迁移工具（已归档）

这些脚本是「旧多页应用 → 真 SPA」迁移时用的生成器，**现在已经不需要**：

| 文件 | 原用途 |
|---|---|
| `extract-view.js` | 从单个旧页面 HTML 里抽出脚本/样式，生成 `js/views/*.js` |
| `batch-extract.js` | 批量跑上面那步 |
| `make-view.js` | 按配置表批量生成视图骨架（含 `--only=` 参数） |
| `post-process-views.js` | 生成后补 ACTION_MAP、把局部函数挂到 window（幂等） |
| `patch-ready.js` | 把 `DOMContentLoaded` 改造成 SPA 可用的就绪判断 |

**它们依赖的旧页面文件已删除**（`frontend/pages/**/*.html`、`frontend/index.html`），
所以现在直接运行会报「找不到源文件」——这是预期行为，不是坏了。

留着是为了需要复盘「某个视图当初是怎么从旧页面抽出来的」时能查。
真要改视图，直接改 `frontend/js/views/*.js` 即可。

日常仍在使用的是上一级目录里的两个检查工具：

```bash
node tools/verify-consistency.js   # 路由 / 模板 / 样式 / 侧边栏覆盖对账
node tools/verify-deps.js          # 视图引用的全局，入口到底加载了没有
```
