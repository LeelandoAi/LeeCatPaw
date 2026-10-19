#!/usr/bin/env python3
# -*- coding: utf-8 -*-@猪猪


"""
源名称：通用模板源
说明：这是一个遵循dr_py规范的通用爬虫模板，用于学习和适配合法数据源。
"""

import json
import requests
from base.spider import Spider


class SpiderCustom(Spider):
    # ==================== 基础配置 ====================
    name = "通用模板源"
    base_url = "https://api.example.com"  # ← 替换为合法API的基础地址
    site_url = "https://www.example.com"  # ← 替换为合法站点的基础地址

    # ==================== 分类映射 ====================
    # ← 根据实际合法站点的分类进行配置
    class_name = ["电影", "电视剧", "综艺", "动漫"]
    class_url = ["movie", "tv", "variety", "anime"]

    # ==================== 请求参数 ====================
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": site_url + "/"
    }
    timeout = 15
    page_size = 20

    # ==================== 工具函数层 ====================
    def _fetch_json(self, url, params=None):
        """安全JSON请求封装"""
        try:
            resp = requests.get(url, headers=self.headers, params=params, timeout=self.timeout)
            resp.encoding = "utf-8"
            return resp.json()
        except Exception as e:
            print(f"[{self.name}] 请求异常: {e}")
            return None

    def _build_vod_item(self, raw):
        """标准化影片条目（消除字段名差异）"""
        return {
            "vod_id": str(raw.get("id", "")),
            "vod_name": raw.get("title", ""),
            "vod_pic": raw.get("cover", ""),
            "vod_remarks": raw.get("update_info", ""),
            "vod_year": raw.get("year", ""),
            "vod_area": raw.get("region", ""),
            "vod_actor": raw.get("actors", ""),
            "vod_director": raw.get("director", ""),
            "vod_type": raw.get("category", ""),
            "vod_score": raw.get("rating", "")
        }

    # ==================== 核心方法实现 ====================
    def homeContent(self, filter=False):
        result = {"list": []}
        # ← 替换为实际的首页推荐接口
        data = self._fetch_json(f"{self.base_url}/v1/recommend")
        if data and data.get("data"):
            for item in data["data"]:
                result["list"].append(self._build_vod_item(item))
        return result

    def categoryContent(self, tid, pg, filter=False, content=None):
        result = {"list": [], "page": pg, "pagecount": 0, "limit": self.page_size, "total": 0}
        # ← 替换为实际的分类列表接口
        params = {"type": tid, "page": pg, "size": self.page_size}
        data = self._fetch_json(f"{self.base_url}/v1/list", params)
        if data and data.get("data"):
            for item in data["data"]["list"]:
                result["list"].append(self._build_vod_item(item))
            result["pagecount"] = data["data"].get("total_pages", 0)
            result["total"] = data["data"].get("total", 0)
        return result

    def detailContent(self, ids):
        result = []
        vod_id = ids if isinstance(ids, str) else ids[0] if ids else ""
        if not vod_id:
            return result

        # ← 替换为实际的详情接口
        data = self._fetch_json(f"{self.base_url}/v1/detail/{vod_id}")
        if not data or not data.get("data"):
            return result

        info = data["data"]
        vod = {
            "vod_id": vod_id,
            "vod_name": info.get("title", ""),
            "vod_pic": info.get("cover", ""),
            "vod_content": info.get("description", ""),
            "vod_play_from": "",
            "vod_play_url": ""
        }

        # ----- 解析播放线路（严格遵守$$$/#/$分隔符规范）-----
        line_names, line_urls = [], []
        for line in info.get("play_list", []):
            line_names.append(line.get("name", "默认"))
            eps = [f"{ep['name']}${ep['url']}" for ep in line.get("episodes", [])]
            line_urls.append("#".join(eps))

        vod["vod_play_from"] = "$$$".join(line_names)
        vod["vod_play_url"] = "$$$".join(line_urls)
        result.append(vod)
        return result

    def searchContent(self, key, pg, filter=False):
        result = {"list": [], "page": pg, "pagecount": 0, "limit": self.page_size, "total": 0}
        if not key:
            return result
        # ← 替换为实际的搜索接口
        params = {"keyword": key, "page": pg}
        data = self._fetch_json(f"{self.base_url}/v1/search", params)
        if data and data.get("data"):
            for item in data["data"]["list"]:
                result["list"].append(self._build_vod_item(item))
            result["pagecount"] = data["data"].get("total_pages", 0)
            result["total"] = data["data"].get("total", 0)
        return result

    def playerContent(self, flag, id, vipFlags=None):
        # ← 根据实际播放逻辑调整
        if ".m3u8" in id or ".mp4" in id:
            return {"parse": 0, "url": id, "header": {"User-Agent": self.headers["User-Agent"]}}
        return {"parse": 1, "url": id, "header": {}}
