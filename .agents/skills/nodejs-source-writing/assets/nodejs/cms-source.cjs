// @name Node.js CMS 源模板
'use strict';

// 参考 index.js 的 createSpider(ctx) 加载器；填写真实 JSON 采集接口后使用。
// 这是完整 API 端点，例如站点的 /api.php/provide/vod/，不是站点首页。
const API = '';

exports.createSpider = function createSpider(ctx) {
    const api = API || process.env.LEECATPAW_CMS_API || '';
    if (!api) throw new Error('请填写 API 或设置 LEECATPAW_CMS_API');
    const endpoint = new URL(api);
    if (!['http:', 'https:'].includes(endpoint.protocol)) throw new Error('API 必须是 HTTP(S) 地址');
    const http = ctx.http.create({ timeout: 15000 });
    const headers = { 'User-Agent': 'LeeCatPaw-SourceTemplate/1.0' };
    // 媒体头与业务 API 头分别配置，避免向媒体域名转发 API 凭据。
    const mediaHeaders = {};
    const one = (value) => String(Array.isArray(value) ? value[0] ?? '' : value ?? '');
    const pageOf = (value) => Math.max(1, Number.parseInt(value, 10) || 1);
    const label = (value) => String(value ?? '').replace(/[$#]/g, '_').trim();

    function absolute(value) {
        const text = String(value ?? '').trim();
        if (!text) return '';
        const url = new URL(text, endpoint);
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('不支持的 URL 协议');
        return url.href;
    }

    async function request(params) {
        const response = await http.get(endpoint.href, { params, headers });
        if (response.status < 200 || response.status >= 300) throw new Error(`CMS HTTP ${response.status}`);
        const data = response.data;
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('CMS 必须返回 JSON 对象');
        if (data.code !== undefined && String(data.code) !== '1') throw new Error('CMS 返回业务错误，请核对接口');
        return data;
    }

    function card(raw) {
        return {
            vod_id: String(raw.vod_id ?? ''),
            vod_name: String(raw.vod_name ?? ''),
            vod_pic: absolute(raw.vod_pic),
            vod_remarks: String(raw.vod_remarks ?? ''),
        };
    }

    function rows(data) {
        if (!Array.isArray(data.list)) throw new Error('CMS 响应缺少 list 数组');
        return data.list.filter((item) => item && typeof item === 'object');
    }

    function listing(data, page) {
        const result = { list: rows(data).map(card).filter((item) => item.vod_id && item.vod_name), page };
        // 只转发真实分页元数据；无总页数时不虚构下一页或总条数。
        for (const field of ['pagecount', 'limit', 'total']) {
            const value = Number(data[field]);
            if (data[field] !== undefined && data[field] !== null && data[field] !== ''
                && Number.isFinite(value) && value >= 0) result[field] = value;
        }
        result.pagecount = Math.max(page, result.pagecount ?? page);
        return result;
    }

    function detail(raw) {
        const froms = String(raw.vod_play_from ?? '').split('$$$');
        const groups = String(raw.vod_play_url ?? '').split('$$$');
        if (froms.length !== groups.length) throw new Error('CMS 播放线路与选集数量不一致');
        const names = [], playlists = [];
        groups.forEach((group, index) => {
            const episodes = group.split('#').filter(Boolean).map((episode, i) => {
                const at = episode.indexOf('$');
                const name = label(at < 0 ? `第${i + 1}集` : episode.slice(0, at));
                const value = (at < 0 ? episode : episode.slice(at + 1)).trim();
                // 参数整体编码，使 URL 中的 $ 不再与选集分隔符冲突。
                return value ? `${name || `第${i + 1}集`}$cms:${encodeURIComponent(value)}` : '';
            }).filter(Boolean);
            if (episodes.length) {
                names.push(label(froms[index]) || `线路${index + 1}`);
                playlists.push(episodes.join('#'));
            }
        });
        return { ...raw, ...card(raw), vod_play_from: names.join('$$$'), vod_play_url: playlists.join('$$$') };
    }

    function play(id) {
        const value = one(id);
        if (!value) throw new Error('播放参数为空');
        const raw = value.startsWith('cms:') ? decodeURIComponent(value.slice(4)) : value;
        if (!/^(https?:\/\/|\/|\.\.?\/)/i.test(raw)) throw new Error('此播放 ID 需要站点专用解析，请修改 play');
        const url = absolute(raw);
        const direct = /\.(m3u8|mp4|mpd|flv|webm|mp3|m4a|aac|ogg|wav)$/i.test(new URL(url).pathname);
        // 无扩展名媒体和特殊线路需按实际响应调整，不能仅凭 HTTP 前缀直连。
        return { parse: direct ? 0 : 1, jx: 0, url, header: { ...mediaHeaders } };
    }

    return {
        // 每个新源必须改为唯一 key/name；type=3 为本项目的视频源分组。
        meta: { key: 'lee_cms_template', name: 'CMS 源模板', type: 3 },
        async api(fastify) {
            // 宿主已按 /spider/<key>/<type> 挂载，插件不要再次追加此前缀。
            fastify.post('/init', async () => ({}));
            fastify.post('/home', async () => {
                const data = await request({ ac: 'list' });
                if (!Array.isArray(data.class)) throw new Error('CMS 响应缺少 class 数组');
                return { class: data.class.map((item) => ({
                    type_id: String(item.type_id ?? ''), type_name: String(item.type_name ?? ''),
                })).filter((item) => item.type_id && item.type_name) };
            });
            fastify.post('/category', async (req) => {
                const page = pageOf(req.body?.page);
                // 筛选需根据站点实际协议映射 req.body.extend；本模板不宣称支持筛选。
                return listing(await request({ ac: 'detail', t: one(req.body?.id), pg: page }), page);
            });
            fastify.post('/search', async (req) => {
                const page = pageOf(req.body?.page), wd = one(req.body?.wd).trim();
                if (!wd) return { list: [], page, pagecount: page };
                return listing(await request({ ac: 'detail', wd, pg: page }), page);
            });
            fastify.post('/detail', async (req) => {
                const ids = (Array.isArray(req.body?.id) ? req.body.id : [req.body?.id])
                    .map((id) => String(id ?? '')).filter(Boolean);
                if (!ids.length) return { list: [] };
                const data = await request({ ac: 'detail', ids: ids.join(',') });
                return { list: rows(data).map(detail) };
            });
            fastify.post('/play', async (req) => play(req.body?.id));
        },
    };
};
