'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { createSpider } = require('../nodejs/cms-source.cjs');

function fixture() {
    process.env.LEECATPAW_CMS_API = 'https://unit.example/api.php/provide/vod/';
    const calls = [], routes = new Map();
    let response = { code: 1, class: [{ type_id: 1, type_name: '电影' }], list: [] };
    let status = 200;
    const ctx = Object.freeze({ http: Object.freeze({ create(options) {
        assert.equal(options.timeout, 15000);
        return { async get(url, { params }) {
            calls.push({ url, params });
            return { status, data: response };
        } };
    } }) });
    const spider = createSpider(ctx);
    const fastify = { post(path, handler) { routes.set(path, handler); } };
    return { spider, routes, calls,
        async init() { await spider.api(fastify); },
        set(data, code = 200) { response = data; status = code; },
        call(path, body = {}) { return routes.get(path)({ body }); },
    };
}

test('工厂接口、六个路由、中文搜索和真实分页', async () => {
    const f = fixture();
    await f.init();
    assert.match(f.spider.meta.key, /^[a-z0-9_-]{2,32}$/);
    assert.equal(f.spider.meta.type, 3);
    assert.deepEqual([...f.routes.keys()].sort(), ['/category', '/detail', '/home', '/init', '/play', '/search']);
    assert.deepEqual(await f.call('/init'), {});
    assert.deepEqual((await f.call('/home')).class, [{ type_id: '1', type_name: '电影' }]);
    f.set({ code: 1, pagecount: '3', total: '48', limit: '20', list: [
        { vod_id: 7, vod_name: '测试', vod_pic: '/poster.jpg' },
    ] });
    const result = await f.call('/search', { wd: '中文 & 测试', page: '2' });
    assert.equal(f.calls.at(-1).params.wd, '中文 & 测试');
    assert.equal(result.page, 2);
    assert.equal(result.pagecount, 3);
    assert.equal(result.total, 48);
    assert.equal(result.list[0].vod_pic, 'https://unit.example/poster.jpg');
    await f.call('/category', { id: 'movie', page: 'bad' });
    assert.deepEqual(f.calls.at(-1).params, { ac: 'detail', t: 'movie', pg: 1 });
    const count = f.calls.length;
    assert.deepEqual(await f.call('/search', { wd: '', page: 2 }), { list: [], page: 2, pagecount: 2 });
    assert.deepEqual(await f.call('/detail', { id: [] }), { list: [] });
    assert.equal(f.calls.length, count);
});

test('多线路详情到播放保持签名参数、支持数组 ID 和网页解析', async () => {
    const f = fixture();
    await f.init();
    f.set({ code: 1, list: [{ vod_id: '7', vod_name: '测试', vod_pic: '//img.example/a.jpg',
        vod_play_from: '主线$$$备用',
        vod_play_url: '第1集$https://media.example/a.m3u8?token=a$b%2Bc#第2集$/b.mp4$$$备用$https://web.example/play?id=7',
    }] });
    const vod = (await f.call('/detail', { id: ['7', '8'] })).list[0];
    assert.equal(f.calls.at(-1).params.ids, '7,8');
    assert.equal(vod.vod_pic, 'https://img.example/a.jpg');
    assert.equal(vod.vod_play_from, '主线$$$备用');
    const groups = vod.vod_play_url.split('$$$');
    assert.equal(groups.length, 2);
    assert.equal(groups[0].split('#').length, 2);
    const token = groups[0].split('#')[0].split('$')[1];
    const play = await f.call('/play', { id: token, flag: '主线' });
    assert.equal(play.url, 'https://media.example/a.m3u8?token=a$b%2Bc');
    assert.equal(play.parse, 0);
    assert.equal((await f.call('/play', { id: groups[0].split('#')[1].split('$')[1] })).url, 'https://unit.example/b.mp4');
    assert.equal((await f.call('/play', { id: groups[1].split('$')[1] })).parse, 1);
    await assert.rejects(f.call('/play', { id: 'opaque-id' }), /站点专用解析/);
});

test('末页、空列表、损坏响应及请求失败不会伪造影片', async () => {
    const f = fixture();
    await f.init();
    f.set({ code: 1, list: [], pagecount: 3, total: 48 });
    assert.deepEqual(await f.call('/category', { id: '1', page: 3 }), { list: [], page: 3, pagecount: 3, total: 48 });
    f.set({ code: 1, list: [] });
    assert.deepEqual(await f.call('/category', { page: 1 }), { list: [], page: 1, pagecount: 1 });
    f.set('<xml/>');
    await assert.rejects(f.call('/home'), /JSON 对象/);
    f.set({ code: 0, msg: '错误' });
    await assert.rejects(f.call('/home'), /业务错误/);
    f.set({}, 503);
    await assert.rejects(f.call('/home'), /HTTP 503/);
    f.set({ list: {} });
    await assert.rejects(f.call('/category'), /list 数组/);
    f.set({ list: [{ vod_play_from: '主线$$$备用', vod_play_url: '1$https://a.example/a.mp4' }] });
    await assert.rejects(f.call('/detail', { id: '7' }), /线路与选集数量/);
});
