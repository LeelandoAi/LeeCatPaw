/*
@header({
  searchable: 2,
  filterable: 1,
  quickSearch: 1,
  title: 'XX苹果CMS[手]',
  '类型': '影视',
  lang: 'ds'
})
*/

// 【模板 B】苹果CMS 采集站 —— 完全手写版（不依赖任何内置模板）
// 适用：需要自定义分类、筛选或模板解析结果不满意时
// 接口速查：
//   分类列表  /api.php/provide/vod/?ac=list
//   视频列表  /api.php/provide/vod/?ac=videolist&t=分类ID&pg=页码
//   视频详情  /api.php/provide/vod/?ac=detail&ids=视频ID
//   搜索      /api.php/provide/vod/?wd=关键字&pg=页码

var rule = {
    title: 'XX苹果CMS[手]',
    host: 'https://cj.xxxapi.com',
    homeUrl: '/api.php/provide/vod/?ac=videolist&t=&pg=1',           // 首页：最新
    url: '/api.php/provide/vod/?ac=videolist&t=fyclass&pg=fypage',   // fyclass=分类ID, fypage=页码
    searchUrl: '/api.php/provide/vod/?wd=**&pg=fypage',              // ** = 搜索关键字
    detailUrl: '/api.php/provide/vod/?ac=detail&ids=fyid',           // fyid = 一级产出的 vod_id

    searchable: 2,
    quickSearch: 1,
    filterable: 1,

    // 分类名 & 分类 ID 一一对应（ID 从 ac=list 接口里抄）
    class_name: '电影&电视剧&综艺&动漫',
    class_url: '1&2&3&4',

    headers: { 'User-Agent': 'MOBILE_UA' },
    timeout: 5000,
    play_parse: true,     // 播放前走 lazy（这里用来给需要解析的源兜底）

    // 首页：结构与一级一致，直接写五段 JSON 规则
    推荐: 'json:list;vod_name;vod_pic;vod_remarks;vod_id',

    // 一级（分类列表）：数组路径 list，取 名称 / 图 / 备注 / ID
    一级: 'json:list;vod_name;vod_pic;vod_remarks;vod_id',

    // 二级（详情）：苹果CMS 的 detail 返回 list[0]，播放信息已是 $$$ 结构，直接映射
    二级: async function () {
        let {input, fetch_params} = this;
        let html = await request(input, fetch_params);
        let json = JSON.parse(html);
        let v = (json.list || [])[0];
        if (!v) return {};
        return {
            vod_id: input,
            vod_name: v.vod_name,
            vod_pic: v.vod_pic,
            type_name: v.type_name,
            vod_year: v.vod_year,
            vod_area: v.vod_area,
            vod_remarks: v.vod_remarks,
            vod_actor: v.vod_actor,
            vod_director: v.vod_director,
            vod_content: v.vod_content,
            // 苹果CMS 原生格式：线路之间 $$$，集之间 #，名称与地址 $
            vod_play_from: v.vod_play_from,
            vod_play_url: v.vod_play_url,
        };
    },

    // 搜索：字段和一级一样，直接抄
    搜索: 'json:list;vod_name;vod_pic;vod_remarks;vod_id',

    // lazy：多数采集站直接给 m3u8，不需要处理；这里演示"必要时清洗地址"
    lazy: async function () {
        let {input} = this;
        // 例：去掉多余参数、只保留 ? 之前的部分
        if (input.includes('?') && !/\.m3u8|\.mp4/.test(input)) {
            input = input.split('?')[0];
        }
        return input;      // 返回字符串 = 直连播放
    },

    // 筛选：苹果CMS 支持 class/area/year/letter 等扩展参数，这里给一个最小示例
    filter_url: '{{fl.sort or "time"}}',
    filter: {
        "1": [{
            "key": "sort", "name": "排序",
            "value": [{n: "最新", v: "time"}, {n: "最热", v: "hits"}, {n: "评分", v: "score"}]
        }]
    },
}
