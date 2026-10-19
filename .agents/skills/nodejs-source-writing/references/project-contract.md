# LeeCatPaw Node.js 源契约

以下来自本项目 `index.js` 和 `index.config.js`，核对日期 2026-10-19；包内变量名由打包工具生成，修改前应按语义锚点重新定位。

## 加载器证据

- `index.config.js` 的 `customSpiders`：默认 `enabled:false`、`dir:''`、`urls:[]`、`allowOverride:false`。
- `index.js` 搜索 `createSpider`：工厂返回对象必须包含 `meta` 和函数 `api`；若提供 `check`，它也必须是函数。加载器另支持兼容模式，新模板直接采用明确的工厂协议。
- 搜索 `http:Object.freeze` 附近的上下文构造：提供 `ctx.http.axios`、`ctx.http.req`、`ctx.http.create`、`ctx.cheerio.load`、`ctx.utils`、`ctx.logger`、`ctx.app.spiderPrefix/nodePath`。上下文被冻结，不要修改它或凭空添加 `ctx.config`。
- 搜索 `meta.type` 的校验：type 为 0–49 的整数；视频 `<10`、阅读 10–19、漫画 20–29、音乐 30–39、网盘 40–49。模板使用视频 `3`，实际听书/音乐任务先确认产品分组。
- 搜索 `e.register(f.api` 附近的语义：加载器给 `api` 注册 `/spider/<meta.key>/<meta.type>` 前缀。源本身只注册相对路径。
- 本地发现只读取 `dir` 的直接文件，支持 `.cjs/.mjs/.js`，不递归扫描；模板放 `templates/nodejs/` 不会自动注册到现有运行包。
- `index.js` 的 `registerLeeLegacy`、`registerLeeDramaAggregates` 等可读段落可参考实际路由；尽量避免直接编辑压缩的第三方包代码。

## 六个 POST 接口

| 相对路径 | 输入 body | 返回对象 |
| --- | --- | --- |
| `/init` | 初始化参数，按具体源使用 | 通常 `{}` |
| `/home` | 可有 `filter` | `{class:[{type_id,type_name}], filters?, list?}` |
| `/category` | `id`, `page`, `filter`, `extend` | `{list,page,pagecount,limit?,total?}` |
| `/search` | `wd`, `page`, `quick` | `{list,page,pagecount,limit?,total?}` |
| `/detail` | `id` 为单个 ID 或数组 | `{list:[详情]}` |
| `/play` | `id` 为播放参数，`flag` 为线路 | `{parse,url,header,jx?}` |

本模板使用原生 `api(fastify)` 路径，因此直接读 `body.extend`；加载器另有 omnibox 对象适配层，其 `filters` 参数与此不同，不能混用。

`vod_id` 在列表/搜索/详情间保持稳定；`vod_play_from` 与 `vod_play_url` 按顺序对应。播放参数是选集 `$` 后的值，本模板以 `cms:` 加完整编码值传递，解码后保留媒体查询串。源站原生串若已含未转义 `#`，需要按该站协议消除歧义。

## 模板数据流

`cms-source.cjs` 针对项目 `cms.list` 已采用的苹果 CMS JSON 形状：分类 `ac=list`，分类/搜索/详情 `ac=detail`；分类带 `t/pg`，搜索带 `wd/pg`，详情带 `ids`。`code` 若存在，成功值当前为 `1`；不同接口按真实响应调整，不假设所有站都兼容。

图片和相对媒体用 URL 补全；卡片转 `vod_id/vod_name/vod_pic/vod_remarks`，详情保留实际元数据。没有 `pagecount` 时暂以当前页终止；若站点用 `next`，需补真实分页逻辑。未定义筛选项，也不宣称支持筛选。

模板媒体扩展名判断只作起点：不透明 ID 应调用站点实际解析接口，无扩展名媒体按真实 Content-Type 或线路语义调整。播放和 API 的鉴权头分别配置。

## 本地接入

1. 复制模板到独立的部署目录，填写真实 API、唯一 key/name；也可在进程启动前设置 `LEECATPAW_CMS_API`。
2. 在实际部署配置中设置 `customSpiders.enabled:true`，`dir` 指向部署目录。避免把技能附件目录当作部署目录，免得加载多个模板副本。
3. 保持 `urls:[]`，本地验证无需启用远程代码。宿主启动后检查 `/config` 中的站点和 `/spider/<key>/3/*` 路由。

配置片段示意，不要未经任务授权写入现有配置：

```js
customSpiders: {
    enabled: true,
    dir: '/替换为实际绝对路径/custom-spiders',
    urls: [],
    strict: true,
    allowOverride: false,
}
```

Node 源通过整个 `index.js.md5` 入口启动运行包，不能把该 `.cjs` 当作 Java `csp_` 类或 QuickJS/ds 规则加载；可对照 [FongMi/TV Node.js 加载说明源码](https://github.com/FongMi/TV/blob/fongmi/website/app/spider/page.tsx)。

## 检查

在项目根目录执行：

```sh
node --check templates/nodejs/cms-source.cjs
node --test templates/tests/nodejs-source.test.cjs
```

在 skill 内独立检查可将路径换成 `assets/nodejs/cms-source.cjs` 和 `assets/tests/nodejs-source.test.cjs`。离线测试使用已冻结的最小 ctx 和路由记录器，覆盖六接口、分页、中文搜索、URL 保真、空结果及响应错误；没有启动正式运行包或请求真实站点。
