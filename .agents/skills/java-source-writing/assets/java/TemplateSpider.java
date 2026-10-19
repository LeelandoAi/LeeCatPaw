package com.github.catvod.spider;

import android.content.Context;
import com.github.catvod.crawler.Spider;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * CatVod/TVBox Java 8 源模板，须放入匹配的 Android Spider 工程编译。
 * init 的 ext: {"api":"填写真实的苹果 CMS JSON 采集接口完整地址"}。
 * 本仓库没有 Java 构建入口；此文件不会被 Node.js 的 customSpiders 加载。
 */
public class TemplateSpider extends Spider {
    private String api = "";

    @Override
    public void init(Context context, String extend) throws Exception {
        super.init(context, extend);
        JSONObject config = new JSONObject(extend == null || extend.trim().isEmpty() ? "{}" : extend);
        api = config.optString("api", "").trim();
        if (api.isEmpty()) throw new IllegalArgumentException("请通过 ext.api 配置 JSON 采集接口");
        httpUrl(api);
    }

    @Override
    public String homeContent(boolean filter) throws Exception {
        JSONArray classes = requestJson(params("ac", "list")).getJSONArray("class");
        return new JSONObject().put("class", classes).toString();
    }

    @Override
    public String homeVideoContent() throws Exception {
        return listing(requestJson(params("ac", "detail", "pg", "1")), 1).toString();
    }

    @Override
    public String categoryContent(String tid, String pg, boolean filter,
                                  HashMap<String, String> extend) throws Exception {
        int page = pageOf(pg);
        // extend 的筛选参数须按目标站点实测协议映射；本模板不提供虚构筛选。
        return listing(requestJson(params("ac", "detail", "t", tid, "pg", String.valueOf(page))), page).toString();
    }

    @Override
    public String searchContent(String key, boolean quick) throws Exception {
        return searchContent(key, quick, "1");
    }

    @Override
    public String searchContent(String key, boolean quick, String pg) throws Exception {
        int page = pageOf(pg);
        if (key == null || key.trim().isEmpty()) return listing(new JSONObject().put("list", new JSONArray()), page).toString();
        return listing(requestJson(params("ac", "detail", "wd", key.trim(), "pg", String.valueOf(page))), page).toString();
    }

    @Override
    public String detailContent(List<String> ids) throws Exception {
        JSONArray result = new JSONArray();
        List<String> wanted = new ArrayList<>();
        if (ids != null) for (String id : ids) if (id != null && !id.isEmpty()) wanted.add(id);
        if (wanted.isEmpty()) return new JSONObject().put("list", result).toString();
        JSONArray rows = requestJson(params("ac", "detail", "ids", join(wanted, ","))).getJSONArray("list");
        for (int i = 0; i < rows.length(); i++) {
            JSONObject raw = rows.optJSONObject(i);
            if (raw == null) continue;
            JSONObject vod = new JSONObject(raw.toString());
            copyCard(raw, vod);
            String[] froms = raw.optString("vod_play_from", "").split("\\$\\$\\$", -1);
            String[] groups = raw.optString("vod_play_url", "").split("\\$\\$\\$", -1);
            if (froms.length != groups.length) throw new IOException("CMS 播放线路与选集数量不一致");
            List<String> names = new ArrayList<>(), playlists = new ArrayList<>();
            for (int j = 0; j < groups.length; j++) {
                List<String> episodes = new ArrayList<>();
                String[] source = groups[j].split("#");
                for (int k = 0; k < source.length; k++) {
                    if (source[k].isEmpty()) continue;
                    int at = source[k].indexOf('$');
                    String name = label(at < 0 ? "第" + (k + 1) + "集" : source[k].substring(0, at));
                    String value = (at < 0 ? source[k] : source[k].substring(at + 1)).trim();
                    if (value.isEmpty()) continue;
                    if (name.isEmpty()) name = "第" + (k + 1) + "集";
                    episodes.add(name + "$cms:" + URLEncoder.encode(value, "UTF-8"));
                }
                if (!episodes.isEmpty()) {
                    String name = label(froms[j]);
                    names.add(name.isEmpty() ? "线路" + (j + 1) : name);
                    playlists.add(join(episodes, "#"));
                }
            }
            vod.put("vod_play_from", join(names, "$$$"));
            vod.put("vod_play_url", join(playlists, "$$$"));
            result.put(vod);
        }
        return new JSONObject().put("list", result).toString();
    }

    @Override
    public String playerContent(String flag, String id, List<String> vipFlags) throws Exception {
        if (id == null || id.isEmpty()) throw new IllegalArgumentException("播放参数为空");
        // id 已是宿主从选集中取出的参数，不再次按 $ 拆分。
        String value = id.startsWith("cms:") ? URLDecoder.decode(id.substring(4), "UTF-8") : id;
        if (!value.matches("(?i)^(https?://|/|\\.\\.?/).*$"))
            throw new IllegalArgumentException("此播放 ID 需要站点专用解析，请修改 playerContent");
        String url = absolute(value);
        boolean direct = new URL(url).getPath().matches("(?i).*\\.(m3u8|mp4|mpd|flv|webm|mp3|m4a|aac|ogg|wav)$");
        // 媒体头单独填写，不把 API 凭据随意转发到媒体域名。
        return new JSONObject().put("parse", direct ? 0 : 1).put("jx", 0)
                .put("url", url).put("header", new JSONObject()).toString();
    }

    private JSONObject listing(JSONObject data, int page) throws Exception {
        JSONArray rows = data.getJSONArray("list"), list = new JSONArray();
        for (int i = 0; i < rows.length(); i++) {
            JSONObject raw = rows.optJSONObject(i);
            if (raw == null) continue;
            JSONObject vod = new JSONObject();
            copyCard(raw, vod);
            if (!vod.getString("vod_id").isEmpty() && !vod.getString("vod_name").isEmpty()) list.put(vod);
        }
        JSONObject result = new JSONObject().put("list", list).put("page", page)
                .put("pagecount", Math.max(page, data.optInt("pagecount", page)));
        for (String field : new String[]{"limit", "total"}) {
            if (data.has(field) && !data.isNull(field) && data.optLong(field, -1) >= 0)
                result.put(field, data.optLong(field));
        }
        return result;
    }

    private void copyCard(JSONObject raw, JSONObject vod) throws Exception {
        vod.put("vod_id", raw.optString("vod_id", ""));
        vod.put("vod_name", raw.optString("vod_name", ""));
        vod.put("vod_pic", absolute(raw.optString("vod_pic", "")));
        vod.put("vod_remarks", raw.optString("vod_remarks", ""));
    }

    private String absolute(String value) throws Exception {
        if (value == null || value.trim().isEmpty()) return "";
        return httpUrl(new URL(httpUrl(api), value.trim()).toExternalForm()).toExternalForm();
    }

    private static URL httpUrl(String value) throws Exception {
        URL url = new URL(value);
        if (!url.getProtocol().equalsIgnoreCase("http") && !url.getProtocol().equalsIgnoreCase("https"))
            throw new IllegalArgumentException("只支持 HTTP(S) URL");
        return url;
    }

    private static String label(String value) {
        return value.replace('$', '_').replace('#', '_').trim();
    }

    private static String join(List<String> items, String separator) {
        StringBuilder result = new StringBuilder();
        for (String item : items) {
            if (result.length() > 0) result.append(separator);
            result.append(item);
        }
        return result.toString();
    }

    private static int pageOf(String value) {
        try { return Math.max(1, Integer.parseInt(value)); }
        catch (NumberFormatException e) { return 1; }
    }

    private static Map<String, String> params(String... pairs) {
        Map<String, String> result = new LinkedHashMap<>();
        for (int i = 0; i < pairs.length; i += 2) result.put(pairs[i], pairs[i + 1] == null ? "" : pairs[i + 1]);
        return result;
    }

    // protected 便于用离线响应样例验证数据流；适配 HTML/API 时在此替换请求实现。
    protected JSONObject requestJson(Map<String, String> params) throws Exception {
        if (api.isEmpty()) throw new IllegalStateException("尚未通过 init 配置 API");
        StringBuilder query = new StringBuilder();
        for (Map.Entry<String, String> entry : params.entrySet()) {
            if (query.length() > 0) query.append('&');
            query.append(URLEncoder.encode(entry.getKey(), "UTF-8")).append('=')
                    .append(URLEncoder.encode(entry.getValue(), "UTF-8"));
        }
        URL endpoint = httpUrl(api);
        if (endpoint.getRef() != null) throw new IllegalArgumentException("API 地址不能包含 fragment");
        String separator = endpoint.getQuery() == null ? "?" : api.endsWith("?") || api.endsWith("&") ? "" : "&";
        HttpURLConnection connection = (HttpURLConnection) httpUrl(api + separator + query).openConnection();
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(15000);
        connection.setRequestProperty("User-Agent", "LeeCatPaw-SourceTemplate/1.0");
        connection.setRequestProperty("Accept", "application/json");
        try {
            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) throw new IOException("CMS HTTP " + status);
            try (InputStream input = connection.getInputStream();
                 ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[8192];
                int n;
                while ((n = input.read(buffer)) != -1) output.write(buffer, 0, n);
                JSONObject data = new JSONObject(new String(output.toByteArray(), "UTF-8"));
                if (data.has("code") && !"1".equals(data.optString("code")))
                    throw new IOException("CMS 返回业务错误，请核对接口");
                return data;
            }
        } finally {
            connection.disconnect();
        }
    }
}
