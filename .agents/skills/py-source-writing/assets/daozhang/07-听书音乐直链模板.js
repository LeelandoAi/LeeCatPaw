/*
@header({
  searchable: 2,
  filterable: 0,
  quickSearch: 0,
  title: 'XX听书',
  '类型': '听书',
  lang: 'ds'
})
*/

// 【模板 G】听书 / 音乐 / 直链类模板
// 特点：列表项本身就是可播地址，不需要「二级」的选集界面，
//       用 vod_url 直接给播放列表；lazy 里可附带歌词 lrc、播放模式 playMode
// 原型：博看听书.js、米兔音乐.js、短剧大全.js

var rule = {
    类型: '听书',
    title: 'XX听书',
    host: 'https://api.bookan.com.cn',

    homeUrl: '/voice/book/list?instance_id=25304&page=1&category_id=1305&num=24',
    url: '/voice/book/list?instance_id=25304&page=fypage&category_id=fyclass&num=24',
    detailUrl: '/voice/album/units?album_id=fyid&page=1&num=200&order=1',
    searchUrl: '/api/v3/voice/book?instanceId=25304&keyword=**&pageNum=fypage&limitNum=20',

    searchable: 2,
    quickSearch: 0,
    filterable: 0,

    class_name: '儿童文学&国学经典&历史小说&相声评书',
    class_url: '1304&1320&1312&1319',

    headers: { 'User-Agent': 'MOBILE_UA' },
    hikerListCol: 'icon_4',        // 列表显示样式：图标+文字
    timeout: 5000,
    play_parse: true,

    // 首页与一级结构一致 → '*' 复用一级规则
    推荐: '*',
    一级: 'json:data.list;name;cover;extra.author;id',
    搜索: '*',

    // 二级：把整张专辑的章节拼成一个播放列表
    二级: async function () {
        let {input} = this;
        let d = [];
        let VOD = { vod_url: input, vod_name: "", vod_actor: "", vod_year: "", vod_director: "" };

        let data = JSON.parse(await request(input)).data;
        VOD.vod_name = data.list[0].title;
        VOD.vod_actor = "▶️创建于" + data.list[0].created_at;
        VOD.vod_year = (data.list[0].created_at || '').split("-")[0];
        VOD.vod_director = "▶️更新于" + data.list[0].updated_at;

        // 分页：单页 200 条，超出就继续翻
        let playlists = data.list;
        let total = data.total;
        if (total > 200) {
            for (let i = 2; i < total / 200 + 1; i++) {
                let listUrl = input.split("&")[0] + "&page=" + i + "&num=200&order=1";
                playlists = playlists.concat(JSON.parse(await request(listUrl)).data.list)
            }
        }

        VOD.vod_play_from = "bookan";
        VOD.vod_play_url = playlists.map(it => it.title + "$" + it.url).join("#");
        return VOD;
    },

    // lazy：直链可直接播；想带歌词/播放模式就返回对象
    lazy: async function () {
        let {input, headers} = this;
        return {
            parse: 0,
            url: input,
            header: headers,
            lrc: '',             // 有歌词接口时在这里填歌词内容
            playMode: 'repeat',  // repeat / random / single
        };
    },
}
