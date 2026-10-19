/*
@header({
  searchable: 2,
  filterable: 1,
  quickSearch: 0,
  title: 'XX影视[J]',
  '类型': '影视',
  lang: 'ds'
})
*/

// 【模板 C】纯 JSON 接口站 —— ds 引擎版
// 适用：接口直接返回 JSON 的站点（api.xxx.com / m.xxx.com / 官方 API）
// 流程：抓包找到 列表/详情/搜索 三个接口 → 填下面的 url → 写五段规则 → 二级用函数拼线路

var rule = {
    title: 'XX影视[J]',
    host: 'https://api.xxx.com',

    homeUrl: '/v1/rank?cat=2&size=9',                                 // 首页推荐（返回 data 数组）
    url: '/v1/list?cat=fyclass&page=fypage&size=30',                  // 分类列表：fyclass 分类, fypage 页码
    searchUrl: '/v1/search?kw=**&page=fypage',                        // 搜索：** 关键字
    detailUrl: '/v1/detail?cat=fyclass&id=fyid',                      // 详情：fyid = 一级产出的链接

    searchable: 2,
    quickSearch: 0,
    filterable: 1,
    multi: 1,
    play_parse: true,

    class_name: '电影&电视剧&综艺&动漫',
    class_url: '1&2&3&4',

    headers: { 'User-Agent': 'MOBILE_UA' },
    timeout: 5000,

    // 如果详情需要两个参数（如 cat + id），链接段用 + 拼接：'cat_id+id'
    // 前段自动填 fyclass，后段自动填 fyid
    推荐: 'json:data;title;cover;remark;cat+id',
    一级: 'json:data.list;title;cover;remark;id',
    搜索: 'json:data.rows;title;cover;remark;cat_id+id',

    // 二级：函数型，负责把详情 JSON 拼成 VOD
    二级: async function () {
        let {input, fetch_params} = this;
        let html = await request(input, fetch_params);
        let json = JSON.parse(html);
        let data = json.data || json;

        // 数组字段拼成字符串（接口给数组时）
        const join = arr => (Array.isArray(arr) ? arr.join(',') : (arr || ''));

        let VOD = {
            vod_id: input,
            vod_name: data.title,
            vod_pic: urljoin(input, data.cover || ''),
            type_name: join(data.category),
            vod_area: join(data.area),
            vod_actor: join(data.actor),
            vod_director: join(data.director),
            vod_content: data.description || '',
            vod_remarks: data.remark || '',
        };

        // 多线路：假设 data.playlist = [{name:'腾讯', episodes:[{n:'第1集', u:'http...'}]}]
        let froms = [], urls = [];
        (data.playlist || []).forEach(site => {
            let items = (site.episodes || []).map(ep => ep.n + '$' + urlDeal(ep.u || ''));
            if (items.length) {
                froms.push(site.name);
                urls.push(items.join('#'));      // 集之间 #
            }
        });
        if (froms.length) {
            VOD.vod_play_from = froms.join('$$$');   // 线路之间 $$$
            VOD.vod_play_url = urls.join('$$$');
        }
        return VOD;
    },

    // lazy：详情页给的地址不能直接播时，在这里换成真地址
    lazy: async function () {
        let {input, fetch_params} = this;
        // 例：输入是 play/12345，需要调接口拿真地址
        if (/^https?:/.test(input)) return input;              // 已是完整地址直接播
        let html = await request(urljoin(rule.host, '/v1/play?u=' + input), fetch_params);
        let json = JSON.parse(html);
        if (json && json.data && json.data.url) {
            return {parse: 0, url: json.data.url, header: rule.headers};
        }
        return input;
    },

    // 筛选：把网页上真实的 query 参数抄成 filter，再用 filter_url 拼回去
    filter_url: 'year={{fl.year or "all"}}&sort={{fl.sort or "hot"}}',
    filter: {
        "1": [
            {key: 'year', name: '年代', value: [{n: '全部', v: 'all'}, {n: '2025', v: '2025'}, {n: '2024', v: '2024'}]},
            {key: 'sort', name: '排序', value: [{n: '最热', v: 'hot'}, {n: '最新', v: 'new'}]}
        ],
        "2": [
            {key: 'year', name: '年代', value: [{n: '全部', v: 'all'}, {n: '2025', v: '2025'}]}
        ]
    },
}
