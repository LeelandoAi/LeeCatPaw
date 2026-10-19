import com.github.catvod.spider.TemplateSpider;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.Arrays;
import java.util.Collections;
import java.util.Map;

/** JVM 离线契约检查；编译时需要真实 Spider API、Android API 与可执行 org.json 实现。 */
public class TemplateSpiderContractTest {
    private static class Fixture extends TemplateSpider {
        JSONObject response;
        Map<String, String> last;
        int calls;
        @Override
        protected JSONObject requestJson(Map<String, String> params) {
            last = params;
            calls++;
            return response;
        }
    }

    private static void check(boolean ok, String message) {
        if (!ok) throw new AssertionError(message);
    }

    public static void main(String[] args) throws Exception {
        Fixture f = new Fixture();
        f.init(null, "{\"api\":\"https://unit.example/api.php/provide/vod/\"}");
        f.response = new JSONObject("{\"class\":[{\"type_id\":\"1\",\"type_name\":\"电影\"}],\"list\":[]}");
        check(new JSONObject(f.homeContent(false)).getJSONArray("class").length() == 1, "分类");
        JSONObject raw = new JSONObject().put("vod_id", 7).put("vod_name", "测试")
                .put("vod_pic", "/poster.jpg").put("vod_play_from", "主线$$$备用")
                .put("vod_play_url", "第1集$https://media.example/a.m3u8?token=a$b%2Bc#第2集$/b.mp4$$$备用$https://web.example/play?id=7");
        f.response = new JSONObject().put("list", new JSONArray().put(raw)).put("pagecount", "3").put("total", "48");
        JSONObject list = new JSONObject(f.categoryContent("1", "bad", false, null));
        check(list.getInt("page") == 1 && list.getInt("total") == 48, "页码与真实总数");
        check(list.getJSONArray("list").getJSONObject(0).getString("vod_pic").equals("https://unit.example/poster.jpg"), "图片补全");
        f.searchContent("中文 & 测试", false, "2");
        check(f.last.get("wd").equals("中文 & 测试") && f.last.get("pg").equals("2"), "中文分页搜索");
        f.searchContent("测试", false);
        check(f.last.get("pg").equals("1"), "旧搜索签名");
        JSONObject vod = new JSONObject(f.detailContent(Arrays.asList("7", "8"))).getJSONArray("list").getJSONObject(0);
        check(f.last.get("ids").equals("7,8"), "数组详情 ID");
        check(vod.getString("vod_play_from").equals("主线$$$备用"), "线路配对");
        String[] groups = vod.getString("vod_play_url").split("\\$\\$\\$");
        String[] episodes = groups[0].split("#");
        check(groups.length == 2 && episodes.length == 2, "多线路选集");
        String token = episodes[0].substring(episodes[0].indexOf('$') + 1);
        JSONObject play = new JSONObject(f.playerContent("主线", token, Collections.emptyList()));
        check(play.getString("url").equals("https://media.example/a.m3u8?token=a$b%2Bc"), "完整保留签名 URL");
        check(play.getInt("parse") == 0, "媒体直连");
        token = groups[1].substring(groups[1].indexOf('$') + 1);
        check(new JSONObject(f.playerContent("备用", token, Collections.emptyList())).getInt("parse") == 1, "网页解析");
        int calls = f.calls;
        check(new JSONObject(f.searchContent("", false, "2")).getJSONArray("list").length() == 0, "空搜索");
        check(new JSONObject(f.detailContent(Collections.emptyList())).getJSONArray("list").length() == 0, "空详情");
        check(f.calls == calls, "空输入不请求");
        f.response = new JSONObject().put("list", new JSONArray()).put("pagecount", 3);
        check(new JSONObject(f.categoryContent("1", "3", false, null)).getInt("pagecount") == 3, "末页终止");
        boolean rejected = false;
        try { f.playerContent("", "opaque-id", Collections.emptyList()); }
        catch (IllegalArgumentException e) { rejected = true; }
        check(rejected, "不把不透明 ID 当作媒体 URL");
        f.response = new JSONObject().put("list", new JSONArray().put(new JSONObject()
                .put("vod_play_from", "主线$$$备用").put("vod_play_url", "1$https://media.example/a.mp4")));
        rejected = false;
        try { f.detailContent(Collections.singletonList("7")); }
        catch (java.io.IOException e) { rejected = true; }
        check(rejected, "拒绝错配线路");
        System.out.println("Java 源模板离线契约检查通过");
    }
}
