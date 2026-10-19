# Python 接口与播放约定

从用户附件提炼的适配起点，具体类名、签名和返回字段以目标宿主及已有可用源为准。

## 常见接口形态

```python
from base.spider import Spider as BaseSpider

class Spider(BaseSpider):
    def getName(self): ...
    def init(self, extend=""): ...
    def homeContent(self, filter=False): ...
    def homeVideoContent(self): ...  # 仅在宿主支持/需要时
    def categoryContent(self, tid, pg, filter=False, extend=None): ...
    def detailContent(self, ids): ...
    def searchContent(self, key, quick=False, pg=1): ...
    def playerContent(self, flag, id, vipFlags=None): ...
```

此代码仅列签名，不是可交付源。不要为了统一外观改坏已有宿主接口。

- 首页分类：`{"class": [{"type_id": "1", "type_name": "电影"}]}`，按宿主需要附加 `filters` / `list`。
- 列表/搜索：如 `{"list": [vod], "page": 1, "pagecount": 3, "limit": 20, "total": 48}`，分页值取自真实数据。
- 详情：要求容器的宿主成功返回 `{"list": [detail]}`，空结果返回 `{"list": []}`；仅在宿主明确接受时直接返回列表。
- 播放：如 `{"parse": 0, "url": media_url, "header": media_headers}`，值类型与额外字段按宿主要求。

条目映射宿主要求的 `vod_id`、`vod_name`、`vod_pic`，可加 `vod_remarks`；详情可加分类、年份、地区、演员、导演和简介，不编造缺失字段。

## 多线路与选集

```python
vod_play_from = "主线$$$备用"
vod_play_url = (
    "第1集$https://media.example/1.m3u8?token=abc"
    "#第2集$https://media.example/2.m3u8?token=def"
    "$$$第1集$https://backup.example/1.mp4"
)
```

- 单集 `名称$参数`，各集用 `#`，各线路用 `$$$` 拼接。同步追加有效线路名与非空选集列表，数量、顺序对应，避免悬空分隔符。
- 保持选集顺序；补全章节时按实际页码分页并在末页/空页终止。
- 站点已返回正确的 `vod_play_from` / `vod_play_url` 时，校验对应关系后可直接映射，避免拆装损伤 URL。
- 原始 URL/名称若与 `$`、`#`、`$$$` 冲突，使用宿主认可的转义方式，或将必要元数据封装为 URL-safe 的不透明播放 ID，在播放方法中对称解码；不要擅自改变媒体 URL。

## 参数传递与请求

`vod_id` 可以是 API ID、详情 URL 或约定的复合 ID，必须能无歧义还原；列表和搜索使用一致策略。

`playerContent` 的 `id` 常为选集中 `$` 后的参数，可能是直链、播放页 URL 或不透明 ID。先查看加载器，避免盲拆 `$`；宿主确实传完整 `名称$地址` 时才按该输入模式拆一次。

媒体请求头可能不同于业务 API。仅保留实际需要的 User-Agent、Referer 等，不把业务凭据随意发送到无关媒体域名。

用 `urljoin(response.url, relative)` 补全图片、详情和播放页链接。区分 API、HTML 播放页与真实媒体；扩展名不能证明实播成功，无扩展名接口也可能返回媒体。

区分业务请求失败与正常末页；没有总数时只用宿主支持的有界分页策略，说明估计值，不制造真实总量。语法检查、本地样例验证、站点联网和客户端实播分别报告。
