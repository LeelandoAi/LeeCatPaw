# 模板索引与已知问题

来源：用户于 2026-10-19 提供的 `模板3.py`、`通用模板.py`、`道长写源模板集 .zip`。三个原始文件已另复制到 LeeCatPaw 项目根目录；本 skill 保存两份 Python 原文件及 ZIP 中七份 JS 原文件，脱离下载目录后仍可使用。附件未执行，示例站点未联网核验。

## 文件索引

| 类型 | 附件 | 借鉴内容 |
| --- | --- | --- |
| Python / HTML | [模板3.py](../assets/python/模板3.py) | OK影视生命周期、分类、列表、详情、搜索、播放 |
| Python / JSON | [通用模板.py](../assets/python/通用模板.py) | 请求、字段标准化、多线路拼接 |
| 苹果 CMS 极简 | [01-苹果CMS采集-极简版.js](../assets/daozhang/01-苹果CMS采集-极简版.js) | 采集接口识别；依赖 JS 宿主“采集1”，Python 需自行实现 |
| 苹果 CMS 手写 | [02-苹果CMS-手写完整版.js](../assets/daozhang/02-苹果CMS-手写完整版.js) | 分类、列表、详情、搜索和已有播放字段映射 |
| JSON 接口 | [03-JSON接口-ds模板.js](../assets/daozhang/03-JSON接口-ds模板.js) | 嵌套字段、复合 ID、数组、多线路和筛选 |
| HTML 网页 | [04-HTML网页-ds模板.js](../assets/daozhang/04-HTML网页-ds模板.js) | 列表选择器、线路区块、播放页提取 |
| dr2 | [05-dr2引擎通用模板.js](../assets/daozhang/05-dr2引擎通用模板.js) | POST 参数、线路/清晰度数据流 |
| 加密 API | [06-加密接口-AES-RSA签名模板.js](../assets/daozhang/06-加密接口-AES-RSA签名模板.js) | 加密请求、签名和响应解密流程示意 |
| 听书 / 音乐 | [07-听书音乐直链模板.js](../assets/daozhang/07-听书音乐直链模板.js) | 章节分页、直链、歌词、播放模式 |

## 模板3.py 的适配问题

- 详情 `re.findall` 返回 `(href, 文本)`，后续推导却使用 `for name, url`，还漏了名称和地址间的 `$`。生成源应使用正确的 `(url, name)` 和 `f"{name}${urljoin(base, url)}"`。
- `super().init(extend)` 是否可用要检查父类，不是所有宿主的强制要求。
- 自定义 `fetch` 可能遮蔽父类同名方法，需检查参数和返回类型；必要时改名 `_request`。
- `playerContent` 的 `id` 通常已由播放器提取为 `$` 后的参数。不要无条件 `id.split('$')[1]`，以免截坏 URL 或复合参数。
- 示例注释把二次提取后的直链也标为 `parse=1`，应依据目标宿主语义决定。
- `verify=False`、全局忽略告警、虚构总条数、`pg+1` 翻页均为示例写法，不直接沿用为默认策略。
- 字符串拼接地址不能完整处理 `../`、`//` 等，改用基于实际页面 URL 的 `urljoin`。
- 失败时返回“视频详情解析失败”等伪影片不宜照抄，使用目标宿主支持的错误或空结果结构。

## 通用模板.py 的适配问题

- 导出类为 `SpiderCustom`；如果宿主按模块属性 `Spider` 加载，应导出继承基类的 `class Spider(BaseSpider)`。
- 配置了 `class_name` / `class_url`，但 `homeContent` 只返回推荐 `list`，没有 `class`；按宿主补首页分类，并确认推荐是否应放在 `homeVideoContent`。
- `detailContent` 直接返回列表，与另一附件的 `{"list": [...]}` 不一致，按宿主统一成功和失败结构。
- `categoryContent(..., content=None)` 与常见 `extend` 命名不同；`searchContent(self, key, pg, filter=False)` 与另一附件的 `(key, quick, pg=1)` 参数语义不同，按实际调用适配。
- `_fetch_json` 未检查 HTTP 错误或 JSON 顶层类型；对 `data["data"]["list"]` 的假设需用实际响应核验。
- `example.com`、`/v1/*` 和各字段仅作示意，不构成真实站点实现。

## JS 转 Python 的边界

- ds 的 `this` / `pdfh` / 五段、六段规则和 dr2 的 `$js.toString` / `setResult` / 全局 `VOD`、`input` 不属于 Python API；转换成 Python 请求、解析和返回字典。
- JS 的 `timeout: 5000` 常按毫秒表达，Python requests 的超时按秒，迁移时核对单位。
- 02 删除查询串的示意可能破坏签名，应保留真实 URL 参数。
- 03 引用的 `urlDeal` 没有在附件定义；HTTP URL 也可能是播放页，不能一律直连。
- 04 的线路区块和标题可能数量不一致，按同一线路区块配对生成。
- 05 的二级引用 `vod_id`，却未在该作用域显式定义；应从传入详情 ID 解码，不能依赖隐含全局变量。
- 06 中标准 WebCrypto 的 `importKey` / `encrypt` / `decrypt` 返回 Promise，附件没有 await，不是已验证的密码学实现；相对路径调用 `.slice(rule.host.length)` 也会切坏路径。
- 加密移植先明确 key/iv 的字节编码、AES 模式及填充、hex/base64、RSA 密钥格式及 padding、时间戳单位和签名原串。用已知输入输出验证，再接业务请求；固定常量只属于示例。
- 07 的歌词、`playMode` 是否支持由 Python 宿主决定；章节分页按实际总数/下一页有界终止，不直接照抄循环。
