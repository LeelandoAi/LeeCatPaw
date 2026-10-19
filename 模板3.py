# OK影视专用爬虫插件模板 | 基于base.spider | 直接复用无需修改基础框架
import sys
import re
import json
import requests
# 可选：请求重试/忽略警告（按需保留）
from requests.adapters import HTTPAdapter
from requests.packages.urllib3.util.retry import Retry
requests.packages.urllib3.disable_warnings()

# 核心：继承OK影视内置base.spider.Spider类（必须保留）
from base.spider import Spider

class Spider(Spider):
    # ========== 插件基础配置（必改：自定义插件名称）==========
    def getName(self):
        """插件名称：OK影视插件列表中显示的名称"""
        return "自定义爬虫插件"  # 例：豆瓣电影、抖音短视频、XX影视

    # ========== 初始化全局配置（必改：自定义站点/请求头/全局变量）==========
    def init(self, extend=""):
        """
        初始化方法：配置站点地址、请求头、会话、全局变量
        extend：插件扩展参数（可留空）
        """
        # 继承父类初始化（必须保留，不可删除）
        super().init(extend)
        
        # 1. 目标站点基础地址（必改：替换为你的爬虫站点）
        self.site_url = "https://www.example.com"
        # 2. 请求头（建议保留移动端UA，适配大部分站点）
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Mobile Safari/537.36",
            "Referer": self.site_url,  # 防盗链：默认指向站点根地址
            "Accept-Language": "zh-CN,zh;q=0.9"
        }
        # 3. 会话保持+请求重试（可选：解决站点不稳定/超时，无需改）
        self.sess = requests.Session()
        self.sess.mount("https://", HTTPAdapter(max_retries=Retry(total=3, backoff_factor=1, status_forcelist=[500, 502, 503, 504])))
        self.sess.mount("http://", HTTPAdapter(max_retries=Retry(total=3, backoff_factor=1, status_forcelist=[500, 502, 503, 504])))
        # 4. 自定义全局参数（按需添加：如分页大小、总条数、分类映射等）
        self.page_size = 20  # 每页默认条数
        self.total = 9999    # 模拟总条数（部分站点无需真实总数，填9999即可）

    # ========== 通用请求方法（无需改：封装GET请求，全局复用）==========
    def fetch(self, url, timeout=10):
        """
        通用GET请求方法：全局复用，处理请求异常
        :param url: 目标请求地址
        :param timeout: 超时时间
        :return: 响应对象/None（请求失败返回None）
        """
        try:
            res = self.sess.get(url, headers=self.headers, timeout=timeout, verify=False)
            # 可选：统一编码（解决部分站点乱码，按需开启）
            # res.encoding = "utf-8" 或 res.encoding = res.apparent_encoding
            return res
        except Exception as e:
            # 可选：打印错误日志（调试用，发布可注释）
            # print(f"请求失败：{url} | 错误：{str(e)}")
            return None

    # ========== 首页分类接口（必改：自定义站点分类）==========
    def homeContent(self, filter):
        """
        首页分类：返回站点分类列表，OK影视首页显示
        :param filter: 分类过滤参数（一般留空，无需处理）
        :return: 固定格式 {'class': [分类字典, ...]}
        分类字典：type_name（分类名称，必选）、type_id（分类标识，必选，唯一）
        """
        # 示例分类（必改：替换为目标站点实际分类）
        cate_list = [
            {"type_name": "最新推荐", "type_id": "new"},
            {"type_name": "电影专区", "type_id": "movie"},
            {"type_name": "电视剧集", "type_id": "tv"},
            {"type_name": "动漫卡通", "type_id": "anime"},
            {"type_name": "综艺娱乐", "type_id": "variety"}
            # 按需添加：如{"type_name": "纪录片", "type_id": "doc"}
        ]
        # 固定返回格式（不可改）
        return {"class": cate_list}

    # ========== 分类列表接口（必改：自定义站点列表解析规则）==========
    def categoryContent(self, tid, pg, filter, extend):
        """
        分类列表：根据分类ID+页码，返回对应视频列表
        :param tid: 分类ID（homeContent中定义的type_id）
        :param pg: 页码（字符串，需转整数）
        :param filter/extend: 过滤/扩展参数（一般留空，无需处理）
        :return: 固定格式 {'list': [视频字典, ...], 'page': 当前页, 'pagecount': 总页数, 'limit': 每页条数, 'total': 总条数}
        """
        # 1. 页码处理（兼容非数字传参，不可改）
        pg = int(pg) if str(pg).isdigit() else 1
        # 2. 构造分类列表请求地址（必改：替换为目标站点的列表URL规则）
        # 示例：根据tid+pg拼接URL，需匹配目标站点的分页规则（如?cid=tid&page=pg 或 /tid/pg.html）
        list_url = f"{self.site_url}/list/{tid}?page={pg}"
        # 3. 请求页面
        res = self.fetch(list_url)
        # 4. 初始化视频列表
        video_list = []
        # 5. 解析页面（必改：替换为目标站点的解析规则，正则/XPath/BeautifulSoup均可）
        if res and res.ok:
            html = res.text
            # 示例：正则解析（按需替换为XPath/BS4，核心是提取视频核心信息）
            # 遍历匹配所有视频项，需根据目标站点HTML结构写正则
            for match in re.finditer(r'<div class="video-item">(.*?)</div>', html, re.S):
                item_html = match.group(1)
                # 提取核心信息（必选：vod_id, vod_name, vod_pic；可选：vod_remarks, style）
                vod_id = re.search(r'href=["\']([^"\']+)["\']', item_html)  # 视频唯一标识（链接/ID）
                vod_name = re.search(r'title=["\']([^"\']+)["\']', item_html)  # 视频名称
                vod_pic = re.search(r'data-src=["\']([^"\']+)["\']', item_html) or re.search(r'src=["\']([^"\']+)["\']', item_html)  # 封面图
                vod_remarks = re.search(r'<span class="tag">(.*?)</span>', item_html)  # 标签（清晰度/集数/年份等，可选）
                
                # 非空判断（避免解析失败报错，不可改）
                if vod_id and vod_name and vod_pic:
                    # 补全封面图地址（相对路径转绝对路径，必做）
                    pic_url = vod_pic.group(1)
                    if pic_url.startswith("//"):
                        pic_url = "https:" + pic_url
                    elif not pic_url.startswith(("http://", "https://")):
                        pic_url = self.site_url + (pic_url if pic_url.startswith("/") else "/" + pic_url)
                    
                    # 构造视频字典（固定字段，不可改字段名）
                    video_list.append({
                        "vod_id": self.site_url + vod_id.group(1) if vod_id.group(1).startswith("/") else vod_id.group(1),  # 补全视频地址为绝对路径
                        "vod_name": vod_name.group(1).strip(),
                        "vod_pic": pic_url,
                        "vod_remarks": vod_remarks.group(1).strip() if vod_remarks else "",  # 可选，无则留空
                        "style": {"type": "rect", "ratio": 1.33}  # 封面样式（可选，矩形1.33适配OK影视UI）
                    })
        # 6. 计算总页数（固定逻辑：有数据则下一页，无则当前页，不可改）
        pagecount = pg + 1 if len(video_list) else pg
        # 7. 固定返回格式（不可改字段名）
        return {
            "list": video_list,
            "page": pg,
            "pagecount": pagecount,
            "limit": self.page_size,
            "total": self.total
        }

    # ========== 视频详情接口（必改：自定义站点详情解析规则）==========
    def detailContent(self, ids):
        """
        视频详情：根据vod_id，返回视频播放信息
        :param ids: 视频ID数组（固定取第一个：ids[0]）
        :return: 固定格式 {'list': [详情字典]}
        详情字典必选字段：vod_id, vod_name, vod_play_from, vod_play_url
        可选字段：vod_pic, vod_remarks, type_name, vod_content（简介）等
        """
        # 1. 获取视频ID/地址（不可改）
        vod_id = ids[0] if ids else ""
        if not vod_id:
            return {"list": [{"vod_name": "视频ID为空"}]}
        # 2. 构造详情请求地址（一般vod_id就是绝对地址，无需改）
        detail_url = vod_id
        # 3. 请求页面
        res = self.fetch(detail_url)
        # 4. 解析详情（必改：提取播放线路和播放地址）
        if res and res.ok:
            html = res.text
            # 示例：提取播放线路（如「主线路」「备用线路1」）和播放地址
            play_from = "主线路"  # 播放线路名称（可多个，用$$$分隔：如「主线路$$$备用线路」）
            # 提取播放地址（核心：格式为「播放节点名$播放地址」，多个地址用#分隔）
            # 例：「第1集$https://xxx.m3u8#第2集$https://yyy.m3u8」
            play_url = ""
            play_match = re.findall(r'<a class="play-link" href=["\']([^"\']+)["\']>(.*?)</a>', html)
            if play_match:
                play_url_list = [f"{name.strip()}{self.site_url + url if url.startswith('/') else url}" for name, url in play_match]
                play_url = "#".join(play_url_list)
            # 构造详情字典（固定格式，不可改核心字段名）
            detail_info = {
                "vod_id": vod_id,
                "vod_name": re.search(r'<h1 class="video-title">(.*?)</h1>', html).group(1).strip() if re.search(r'<h1 class="video-title">(.*?)</h1>', html) else "未知名称",
                "vod_pic": re.search(r'<img class="video-pic" data-src=["\']([^"\']+)["\']', html).group(1) if re.search(r'<img class="video-pic" data-src=["\']([^"\']+)["\']', html) else "",
                "vod_remarks": "高清1080P",  # 可选：替换为实际解析的标签
                "type_name": "视频分类",     # 可选：视频所属分类
                "vod_play_from": play_from,  # 必选：播放线路
                "vod_play_url": play_url     # 必选：播放地址（按规范拼接）
            }
            return {"list": [detail_info]}
        # 解析失败返回提示（不可改）
        return {"list": [{"vod_id": vod_id, "vod_name": "视频详情解析失败"}]}

    # ========== 搜索接口（按需改：复用分类列表解析逻辑，仅改URL）==========
    def searchContent(self, key, quick, pg=1):
        """
        搜索接口：根据关键词，返回搜索结果列表
        :param key: 搜索关键词
        :param quick: 快速搜索标识（一般留空，无需处理）
        :param pg: 页码
        :return: 和categoryContent一致的列表格式
        核心：复用分类列表的解析逻辑，仅需修改搜索URL构造规则
        """
        # 1. 页码处理（不可改）
        pg = int(pg) if str(pg).isdigit() else 1
        # 2. 构造搜索URL（必改：替换为目标站点的搜索URL规则，需做URL编码）
        search_url = f"{self.site_url}/search?wd={requests.utils.quote(key)}&page={pg}"
        # 3. 请求页面
        res = self.fetch(search_url)
        # 4. 初始化视频列表
        video_list = []
        # 5. 解析页面（**直接复用categoryContent的解析规则**，无需重复写，按需微调）
        if res and res.ok:
            html = res.text
            for match in re.finditer(r'<div class="video-item">(.*?)</div>', html, re.S):
                item_html = match.group(1)
                vod_id = re.search(r'href=["\']([^"\']+)["\']', item_html)
                vod_name = re.search(r'title=["\']([^"\']+)["\']', item_html)
                vod_pic = re.search(r'data-src=["\']([^"\']+)["\']', item_html) or re.search(r'src=["\']([^"\']+)["\']', item_html)
                if vod_id and vod_name and vod_pic:
                    pic_url = vod_pic.group(1)
                    if pic_url.startswith("//"):
                        pic_url = "https:" + pic_url
                    elif not pic_url.startswith(("http://", "https://")):
                        pic_url = self.site_url + (pic_url if pic_url.startswith("/") else "/" + pic_url)
                    video_list.append({
                        "vod_id": self.site_url + vod_id.group(1) if vod_id.group(1).startswith("/") else vod_id.group(1),
                        "vod_name": vod_name.group(1).strip(),
                        "vod_pic": pic_url,
                        "vod_remarks": "搜索结果",
                        "style": {"type": "rect", "ratio": 1.33}
                    })
        # 6. 计算总页数（不可改）
        pagecount = pg + 1 if len(video_list) else pg
        # 7. 固定返回格式（不可改）
        return {
            "list": video_list,
            "page": pg,
            "pagecount": pagecount,
            "limit": self.page_size,
            "total": len(video_list) if len(video_list) < self.total else self.total
        }

    # ========== 播放解析接口（必改：自定义站点播放地址解析规则）==========
    def playerContent(self, flag, id, vipFlags):
        """
        播放解析：解析播放地址，返回可直接播放的链接
        :param flag: 播放线路标识（detailContent中定义的vod_play_from，一般留空）
        :param id: 待解析的地址（detailContent中拼接的播放地址，如「第1集$https://xxx」）
        :param vipFlags: VIP标识（一般留空，无需处理）
        :return: 固定格式 {"parse": 0/1, "url": 最终播放地址, "header": 请求头}
        parse=0：无需解析，id已是可直接播放的地址（m3u8/mp4/flv）
        parse=1：需要二次解析，url为二次解析后的播放地址
        """
        # 1. 解析原始播放地址（拆分「节点名$地址」，不可改）
        play_url = id.split("$")[1] if "$" in id else id
        if not play_url:
            return {"parse": 0, "url": "", "header": self.headers}
        # 2. 播放地址解析（必改：根据站点规则，处理需二次解析的地址）
        # 示例1：无需二次解析（直接返回原地址，parse=0）→ 大部分m3u8/mp4地址可用
        final_url = play_url
        parse_type = 0
        # 示例2：需要二次解析（如加密地址/跳转地址，需请求后提取真实地址，parse=1）
        # res = self.fetch(play_url)
        # if res and res.ok:
        #     final_url = re.search(r'var playUrl = "([^"]+)"', res.text).group(1)
        #     parse_type = 1
        # 3. 固定返回格式（不可改，请求头可复用全局headers）
        return {
            "parse": parse_type,
            "url": final_url,
            "header": self.headers
        }

# ========== 无额外入口（OK影视自动识别Spider类，无需添加main函数）==========
