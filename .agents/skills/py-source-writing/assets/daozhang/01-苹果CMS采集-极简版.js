/*
@header({
  searchable: 2,
  filterable: 0,
  quickSearch: 1,
  title: '某某资源[资]',
  '类型': '影视',
  lang: 'ds'
})
*/

// 【模板 A】苹果CMS 采集站 —— 零解析版
// 适用：站点提供 /api.php/provide/vod/?ac=list 接口的采集站（暴风/非凡/量子/魔都/金鹰/极速 全是这一类）
// 做法：只要填 host，其余交给 App 里名为「采集1」的规则模板（App 设置里的"规则模板"功能）
// 验证方法：浏览器打开 https://你的域名/api.php/provide/vod/?ac=list 能看到 XML/JSON 分类列表即可用

var rule = {
    模板: '采集1',        // 继承模板：苹果CMS 通用解析逻辑（一级/二级/搜索/筛选全部由模板提供）
    title: '某某资源[资]', // 小程序名称，随便改
    host: 'https://bfzyapi.com',   // ← 只改这里：站点根域名（不要带尾斜杠）

    // homeTid：首页推荐默认展示哪个分类的 ID；留空 = 全部
    // 想知道 ID？打开 /api.php/provide/vod/?ac=list 看 <ty id="1"> 里的 id
    homeTid: '',

    // cate_exclude：按分类名剔除不想显示的分类，| 分隔
    cate_exclude: '电影片|连续剧|综艺片|动漫片|电影解说|体育|演员|新闻资讯',

    // parse_url：老式全局解析接口前缀，需要网页解析时填，如 'json:http://jx.xxx.com/?url='
    // 采集站一般直接给 m3u8，留空即可
    parse_url: '',
}
