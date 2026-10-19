# 项目背景与 Java 接口约定

## 参考来源与边界

- `LeeCatPaw/index.js` 的 `registerLeeLegacy`、`registerLeeMigration` 等代码保留了从旧 Java 源迁移的数据结构：`class`、`list`、`vod_*`、播放线路和 `/init` 等路由。`index.config.js` 的 `cms.list` 使用苹果 CMS 采集端点，因此本模板以该 JSON 数据结构作为起点。
- 当前仓库没有 Java 源工程、Gradle 配置或 Spider API JAR。Node.js 的 `createSpider(ctx)`、Fastify、`ctx.http` 不属于 Java 宿主接口。
- Java 生命周期和包名参照 [FongMi/TV 爬虫介接说明源码](https://github.com/FongMi/TV/blob/fongmi/website/app/spider/page.tsx)。此次实现还只读核对了本机相邻 `CatVodTVSpider` 工程的真实 `com.github.catvod.crawler.Spider`，但模板不依赖该工程的绝对路径，其他机器应提供匹配的宿主 API。

## Java 生命周期

| 方法 | 参数和结果 |
| --- | --- |
| `init(Context context, String extend)` | 模板读取 `ext.api` 的 JSON 配置，检查 HTTP(S) 地址 |
| `homeContent(boolean filter)` | 返回 `class`，实际支持筛选时才加 `filters` |
| `homeVideoContent()` | 返回首页推荐 `list` |
| `categoryContent(String tid, String pg, boolean filter, HashMap<String,String> extend)` | 分类来自 `tid`，页码是字符串，已选筛选在 `extend` |
| `detailContent(List<String> ids)` | 输入 ID 数组，返回 `{"list":[详情]}` |
| `searchContent(String key, boolean quick)` | 委托分页版第 1 页，兼容旧宿主 |
| `searchContent(String key, boolean quick, String pg)` | 中文搜索和分页 |
| `playerContent(String flag, String id, List<String> vipFlags)` | `flag` 是线路名，`id` 是单集参数，返回 `parse/url/header` 的 JSON 字符串 |

这些签名已按真实基类编译检查；其他宿主有差异时以其 API 为准。

## 采集协议起点

模板使用 GET，参数以 UTF-8 编码：分类 `ac=list`，推荐/分类/搜索/详情 `ac=detail`；分类加 `t/pg`，搜索加 `wd/pg`，详情加 `ids`。响应需为苹果 CMS 风格 JSON 对象、`class` 或 `list` 数组；如有 `code`，当前检查成功值为 `1`。JSON 以外的 XML、私有路径和不同成功码需按实测适配。

卡片映射 `vod_id/vod_name/vod_pic/vod_remarks`；详情保留实际元数据并生成播放串。分页只返回真实总量；缺少 `pagecount` 时暂以当前页终止，站点若通过 `next` 分页须替换此策略。

源站原生播放串已经使用 `#` 分集；如源站在原生串内直接混入未转义的 `#`，此时原始格式本身存在歧义，应按该站实际协议处理。模板在拆出原生单集后才编码播放参数。

## 宿主接入

把 `TemplateSpider.java` 放到匹配 Android 工程的 `com/github/catvod/spider/` 目录，改名后同步类名。配置示意（尖括号内容需要替换）：

```json
{
  "spider": "<编译后的真实 JAR 地址>",
  "sites": [{
    "key": "java_my_cms",
    "name": "自定义采集源",
    "type": 3,
    "api": "csp_TemplateSpider",
    "searchable": 1,
    "quickSearch": 1,
    "filterable": 0,
    "ext": {"api": "<真实 JSON 采集接口完整 URL>"}
  }]
}
```

该片段供支持 Java/JAR 的播放器使用，不是本项目 `index.config.js` 的 Node 自定义源配置。JAR 的打包、DEX、混淆保留规则由目标宿主工程决定；至少确保按名称加载的 Spider 类不会被错误改名。

## 本次验证及复用

2026-10-19：使用 Java 8 编译目标、本机真实 Spider 基类、Android API 和可执行 `org.json` 完成编译及离线契约检查。依赖通过外部 classpath 提供，没有复制基类或 JAR 到仓库；未构建 Android 包、未请求真实站点、未客户端实播。

复用离线检查时，以实际路径填入 `SPIDER_API_CP`（真实 Spider API、Android API，以及其必要依赖）和 `ORG_JSON_JAR`（可在 JVM 运行的 org.json 实现），并使用临时输出目录：

```sh
javac --release 8 -encoding UTF-8 -cp "$SPIDER_API_CP:$ORG_JSON_JAR" -d "$TEMPLATE_CLASSES_DIR" templates/java/TemplateSpider.java templates/tests/TemplateSpiderContractTest.java
java -cp "$TEMPLATE_CLASSES_DIR:$ORG_JSON_JAR:$SPIDER_API_CP" TemplateSpiderContractTest
```

`android.jar` 内的 JSON 类通常只是编译 stub，不能代替可执行的 org.json；JVM 测试时让可执行实现位于其之前。真实 HTTP 错误、重定向和播放器行为仍需集成验证。
