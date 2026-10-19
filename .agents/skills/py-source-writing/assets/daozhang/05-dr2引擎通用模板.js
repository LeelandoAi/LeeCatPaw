/*
@header({
  searchable: 2,
  filterable: 1,
  quickSearch: 1,
  title: 'XX影视[dr2]',
  '类型': '影视',
  lang: 'dr2'
})
*/

// 【模板 E】dr2 引擎通用模板
// 与 ds 的三大区别：
//   1. 每个函数体必须用 $js.toString(() => { ... }) 包裹
//   2. 变量直接是全局的：input / MY_PAGE / MY_CATE / MY_FL / KEY / VOD / rule
//   3. 返回方式：列表用 setResult(d)，详情用 VOD = {...}，lazy 用 input = {...}

var rule = {
    title: 'XX影视[dr2]',
    host: 'https://api.cj7wq4.com',

    url: '/App/IndexList/indexList',
    homeUrl: '/App/IndexList/index',
    searchUrl: '/App/Index/findMoreVod',
    detailUrl: '/App/IndexPlay/playInfo',

    searchable: 2,
    quickSearch: 1,
    filterable: 1,
    play_parse: true,

    class_name: '电影&电视剧&动漫&综艺&短剧',
    class_url: '1&2&4&3&64',

    headers: { 'User-Agent': 'okhttp/3.12.0' },
    timeout: 5000,

    // 公共请求封装：dr2 里可以定义全局函数，所有规则位都能调用
    // （真实案例见「嗷呜瓜子.js」的 Getdata）

    // 首页推荐
    推荐: $js.toString(() => {
        let d = [];
        let data = JSON.parse(request(rule.host + '/App/IndexList/index')).list;
        data.forEach(item => {
            d.push({
                title: item.vod_name,
                desc: item.vod_continu == 0 ? '电影' : '更新至' + item.vod_continu + '集',
                img: item.vod_pic,
                url: `${item.vod_id}/${item.vod_continu}`,   // 复合链接，二级里用 vod_id 取第一段
            })
        })
        setResult(d)      // ← dr2 的列表返回方式
    }),

    // 分类列表：MY_CATE = 分类ID，MY_PAGE = 页码，MY_FL = 筛选对象
    一级: $js.toString(() => {
        let d = [];
        let body = {
            "area": MY_FL.area || '0',
            "year": MY_FL.year || '0',
            "pageSize": "30",
            "sort": MY_FL.sort || 'd_id',
            "page": MY_PAGE,
            "tid": MY_CATE
        }
        let list = JSON.parse(fetch(rule.host + rule.url, {
            headers: rule.headers,
            body: body,
            method: 'POST'
        })).data.list;

        list.forEach(data => {
            d.push({
                title: data.vod_name,
                desc: data.vod_continu == 0 ? '电影' : '更新至' + data.vod_continu + '集',
                year: data.vod_scroe,
                img: data.vod_pic,
                url: `${data.vod_id}/${data.vod_continu}`,
            })
        })
        setResult(d)
    }),

    // 详情：赋值给全局 VOD 即返回
    二级: $js.toString(() => {
        let t = Math.floor(new Date().getTime() / 1000).toString()
        let qdata = JSON.parse(fetch(rule.host + rule.detailUrl, {
            headers: rule.headers,
            body: { "token_id": "1649412", "vod_id": vod_id, "mobile_time": t, "token": "" },
            method: 'POST'
        })).data
        let jdata = JSON.parse(fetch(rule.host + '/App/Resource/Vurl/show', {
            headers: rule.headers,
            body: { "vurl_cloud_id": "2", "vod_d_id": vod_id },
            method: 'POST'
        })).data

        let vod = qdata.vodInfo;
        vod.vod_content = (vod.vod_use_content || '').trim();

        let r = [];
        jdata.list.forEach((item, index) => {
            let n = [], p = [];
            Object.entries(item.play || {}).forEach(([key, value]) => {
                if (value.param) { n.push(key); p.push(value.param); }
            });
            let cm = String(index + 1);
            if (jdata.list.length === 1) cm = vod.vod_name;
            r.push(`${cm}$${p[p.length - 1]}||${n.join('@')}`);   // 名称$参数||清晰度列表
        });
        vod.vod_play_from = '默认线路';
        vod.vod_play_url = r.join('#');
        VOD = vod          // ← dr2 的详情返回方式
    }),

    // 搜索：KEY 是关键字
    搜索: $js.toString(() => {
        let d = [];
        let data = JSON.parse(fetch(rule.host + rule.searchUrl, {
            headers: rule.headers,
            body: { "keywords": KEY, "order_val": "1" },
            method: 'POST'
        })).data
        data.list.forEach(data => {
            d.push({
                title: data.vod_name,
                desc: data.vod_continu == 0 ? '电影' : '更新至' + data.vod_continu + '集',
                content: data.vod_addtime,
                img: data.vod_pic,
                url: `${data.vod_id}/${data.vod_continu}`,
            })
        })
        setResult(d)
    }),

    // 播放解析：直接改写 input 即返回；url 为数组 = 多清晰度（名称,地址成对）
    lazy: $js.toString(() => {
        let ids = input.split('||')
        let body = {};
        ids[0].split('&').forEach(pair => {
            const [key, value] = pair.split('=');
            body[key] = value;
        });
        let urls = []
        let resolutions = ids[ids.length - 1].split('@');
        resolutions.sort((a, b) => Number(b) - Number(a));    // 清晰度从高到低
        resolutions.forEach(item => {
            body.resolution = item
            let url = JSON.parse(fetch(rule.host + '/App/Resource/VurlDetail/showOne', {
                headers: rule.headers, body: body, method: 'POST'
            })).data.url
            urls.push(item, url)
        })
        input = { url: urls, parse: 0, header: rule.headers }
    }),

    // 筛选：{{fl.xxx}} 取自 filter 里定义的 key
    filter_url: 'area={{fl.area or "0"}}&year={{fl.year or "0"}}',
    filter: {
        "1": [
            {key: 'area', name: '地区', value: [{n: '全部', v: '0'}, {n: '内地', v: '1'}, {n: '日韩', v: '2'}]},
            {key: 'year', name: '年代', value: [{n: '全部', v: '0'}, {n: '2025', v: '2025'}, {n: '2024', v: '2024'}]}
        ]
    },
}
