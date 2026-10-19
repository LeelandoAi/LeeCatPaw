/*
@header({
  searchable: 2,
  filterable: 0,
  quickSearch: 0,
  title: 'XX网页[H]',
  '类型': '影视',
  lang: 'ds'
})
*/

// 【模板 D】HTML 网页站 —— ds 引擎 + pdfh 选择器
// 适用：站点没有 JSON 接口，只能抓 HTML 页面（海洋CMS、苹果CMS 前端、各类模板站）
// 六段规则：<列表容器>;<列表项>;<标题>;<图片>;<描述>;<链接>
// 五段规则：<容器+项>;<标题>;<图片>;<描述>;<链接>

var rule = {
    title: 'XX网页[H]',
    host: 'https://www.xxx.com',

    homeUrl: '/',                                       // 首页
    url: '/vod/show/id/fyclass/page/fypage.html',       // 分类列表
    searchUrl: '/vod/search.html?wd=**',                // 搜索（POST 时见下方函数写法）
    detailUrl: '/vod/detail/id/fyid.html',              // 详情页

    searchable: 2,
    quickSearch: 0,
    filterable: 0,
    play_parse: true,
    double: true,        // 列表双列
    limit: 5,            // 首页每类最多显示条数

    class_name: '电影&电视剧&综艺&动漫',
    class_url: '1&2&3&4',

    headers: { 'User-Agent': 'MOBILE_UA' },
    timeout: 5000,

    // 首页推荐：六段（容器 .pic-list / 项 .items / 标题 / 图 / 描述 / 链接）
    推荐: '.pic-list.list-box;.items;.text&&Text;mip-img&&src;.all&&Text;a&&href',

    // 分类列表：五段（容器 && 项 写在一起）
    一级: '.list-con&&.items;.text&&Text;mip-img&&src;.time&&Text;a&&href',

    // 搜索：与一级结构一致时，可直接复用（'*' = 沿用一级规则）
    搜索: '*',

    // 二级：手写函数，用 pdfh 从详情页抠信息
    二级: async function () {
        let {input, fetch_params, pdfh} = this;
        let html = await request(input, fetch_params);

        let VOD = {
            vod_id: input,
            vod_name: pdfh(html, 'h1.title&&Text'),
            vod_pic: urljoin(rule.host, pdfh(html, '.detail-pic img&&data-original') || pdfh(html, '.detail-pic img&&src')),
            vod_content: pdfh(html, '.detail-content&&Text'),
            vod_remarks: pdfh(html, '.detail-remarks&&Text'),
        };

        // 线路名：tab 标题
        let froms = [], urls = [];
        // 注意：pdfl 返回二维列表；这里演示用 pdfh 逐段处理
        let tabsHtml = pdfh(html, '.tab-content&&Html');      // 播放区整块
        let blocks = (tabsHtml || '').split('id="playlist').slice(1);
        blocks.forEach(sec => {
            let items = [];
            let re = /<a href="([^"]+)">([^<]+)<\/a>/g, m;
            while ((m = re.exec(sec)) !== null) {
                items.push(m[2].trim() + '$' + urljoin(rule.host, m[1]));   // 名称$地址
            }
            if (items.length) urls.push(items.join('#'));
        });
        // 线路名
        let re2 = /<a href="#playlist\d+"[^>]*>([\s\S]*?)<\/a>/g, m2;
        while ((m2 = re2.exec(html)) !== null) froms.push(m2[1].trim());

        if (urls.length) {
            VOD.vod_play_from = froms.slice(0, urls.length).join('$$$');
            VOD.vod_play_url = urls.join('$$$');
        }
        return VOD;
    },

    // lazy：详情页给的是播放页，需要抠出真实 m3u8
    lazy: async function () {
        let {input, fetch_params, pdfh} = this;
        let html = await request(input, fetch_params);

        // 情况1：页面里直接有 video 标签地址
        let src = pdfh(html, 'body&&video&&src');
        if (src) return {parse: 0, url: urljoin(rule.host, src), header: rule.headers};

        // 情况2：播放器变量里（常见于苹果CMS：player_aaaa = {"url":"..."}）
        let m = html.match(/player_aaaa\s*=\s*(\{[\s\S]*?\})/);
        if (m) {
            let obj = JSON.parse(m[1]);
            let u = (obj.url || '').replace(/\\/g, '');
            if (/\.m3u8|\.mp4/.test(u)) return {parse: 0, url: u, header: rule.headers};
            // 情况3：需要第三方解析接口
            return {parse: 1, url: u, header: rule.headers};
        }
        return input;
    },
}
