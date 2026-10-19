/*
@header({
  searchable: 2,
  filterable: 1,
  quickSearch: 1,
  title: 'XX加密站[AES]',
  '类型': '影视',
  lang: 'dr2'
})
*/

// 【模板 F】加密接口站骨架（AES 请求体 + RSA 交换密钥 + MD5 签名）
// 原型：嗷呜瓜子.js。逆向步骤：
//   1. DevTools → Sources 搜 encrypt / AES / CryptoJS / sign / signature / RSA
//   2. 打断点，记录：密钥 key、iv、加密模式（CBC/ECB）、填充（Pkcs7）、输出格式（hex/base64）
//   3. 记录签名串的拼接顺序与盐值
//   4. 在规则里 1:1 复现下面这套函数

// ---------- ① AES-CBC 加解密（dr2 引擎用内置 WebCrypto，也可用 CryptoJS）----------
globalThis.Aesalg = function (text, key, iv, dd) {
    const keyArray = new TextEncoder().encode(key);
    const ivArray = new TextEncoder().encode(iv);
    const importedKey = crypto.subtle.importKey(
        "raw", keyArray, { name: "AES-CBC" }, false, dd ? ["encrypt"] : ["decrypt"]
    );
    if (dd) {
        const encryptedArray = crypto.subtle.encrypt(
            { name: "AES-CBC", iv: ivArray }, importedKey, new TextEncoder().encode(text)
        );
        // 加密结果转 HEX 大写
        return Buffer.from(encryptedArray, 'utf8').toString('hex').toUpperCase();
    } else {
        const decryptedArray = crypto.subtle.decrypt(
            { name: "AES-CBC", iv: ivArray }, importedKey, new Uint8Array(Buffer.from(text, "hex"))
        );
        return new TextDecoder().decode(decryptedArray);
    }
};

// ---------- ② 固定凭据（抓包/反编译拿到，会过期，需定期更新）----------
globalThis.Token = '这里填 App 的 token';
const bodykey = "这里填内置 RSA 私钥(PKCS#8 PEM 去掉头尾)";
const keys = "这里填随请求一起发的 keys 字段(服务端用它回传加密后的 key)";

// ---------- ③ 统一请求函数：加密 → 签名 → POST → 解密 ----------
globalThis.Getdata = function (data, host, path) {
    let headers = {
        'Cache-Control': 'no-cache',
        'Version': '2406025',                                     // App 版本号，从请求头抄
        'PackageName': 'com.xxx.xxx',                             // 包名，从请求头抄
        'Ver': '1.9.2',
        'Referer': host,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'okhttp/3.12.0'                             // 伪装成 App
    }
    // 请求体 AES 加密
    let key = Aesalg(JSON.stringify(data), 'mvXBSW7ekreItNsT', '2U3IrJL8szAKp0Fj', 1)
    let t = Math.floor(new Date().getTime() / 1000).toString()

    // 签名串：把关键参数按服务端顺序拼好 + 固定盐
    let signstr = `token_id=,token=${Token},phone_type=1,request_key=${key},app_id=1,time=${t},keys=${keys}*&盐值`;
    let body = {
        'token': Token, 'token_id': '', 'phone_type': '1', 'time': t,
        'phone_model': 'xiaomi-22021211rc',
        'keys': keys, 'request_key': key,
        'signature': md5(signstr),
        'app_id': '1', 'ad_version': '1'
    }

    let res = JSON.parse(fetch(`${host}${path}`, { headers, body, method: 'POST' })).data

    // RSA 解出本次的 AES key/iv，再解业务数据
    let bodyki = JSON.parse(RSA.decode(res.keys, bodykey))
    return JSON.parse(Aesalg(res.response_key, bodyki.key, bodyki.iv))
}

// ---------- ④ 规则主体 ----------
var rule = {
    title: 'XX加密站[AES]',
    host: 'https://api.xxx.com',
    url: '/App/IndexList/indexList',
    homeUrl: '/App/Resource/VurlDetail/showOne',
    searchUrl: '/App/Index/findMoreVod',
    detailUrl: '/App/IndexPlay/playInfo',

    searchable: 2,
    quickSearch: 1,
    filterable: 1,
    play_parse: true,

    class_name: '电影&电视剧&动漫&综艺&短剧',
    class_url: '1&2&4&3&64',

    headers: { 'User-Agent': 'okhttp/3.12.0' },

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
        // 注意：Getdata 的第三个参数要去掉 host 前缀
        let list = Getdata(body, rule.host, rule.url.slice(rule.host.length)).list;
        list.forEach(data => {
            d.push({
                title: data.vod_name,
                desc: data.vod_continu == 0 ? '电影' : '更新至' + data.vod_continu + '集',
                img: data.vod_pic,
                url: `${data.vod_id}/${data.vod_continu}`,
            })
        })
        setResult(d)
    }),

    二级: $js.toString(() => {
        let t = Math.floor(new Date().getTime() / 1000).toString()
        let qdata = Getdata({
            "token_id": "1649412", "vod_id": vod_id, "mobile_time": t, "token": Token
        }, rule.host, rule.detailUrl.slice(rule.host.length))
        let jdata = Getdata({
            "vurl_cloud_id": "2", "vod_d_id": vod_id
        }, rule.host, '/App/Resource/Vurl/show')

        let vod = qdata.vodInfo;
        vod.vod_content = (vod.vod_use_content || '').trim();

        let r = [];
        jdata.list.forEach((item, index) => {
            let n = [], p = [];
            Object.entries(item.play || {}).forEach(([key, value]) => {
                if (value.param) { n.push(key); p.push(value.param); }
            });
            let cm = jdata.list.length === 1 ? vod.vod_name : String(index + 1);
            r.push(`${cm}$${p[p.length - 1]}||${n.join('@')}`);
        });
        vod.vod_play_from = '默认线路';
        vod.vod_play_url = r.join('#');
        VOD = vod
    }),

    搜索: $js.toString(() => {
        let d = [];
        let data = Getdata({ "keywords": KEY, "order_val": "1" },
                           rule.host, rule.searchUrl.slice(rule.host.length))
        data.list.forEach(data => {
            d.push({ title: data.vod_name, desc: '', content: data.vod_addtime,
                     img: data.vod_pic, url: `${data.vod_id}/${data.vod_continu}` })
        })
        setResult(d)
    }),

    lazy: $js.toString(() => {
        let ids = input.split('||')
        let body = {};
        ids[0].split('&').forEach(pair => {
            const [key, value] = pair.split('='); body[key] = value;
        });
        let urls = []
        let resolutions = ids[ids.length - 1].split('@');
        resolutions.sort((a, b) => Number(b) - Number(a));
        resolutions.forEach(item => {
            body.resolution = item
            let url = Getdata(body, rule.host, rule.homeUrl.slice(rule.host.length)).url
            urls.push(item, url)
        })
        input = { url: urls, parse: 0, header: rule.headers }
    }),

    filter_url: 'area={{fl.area or "0"}}&year={{fl.year or "0"}}',
}
