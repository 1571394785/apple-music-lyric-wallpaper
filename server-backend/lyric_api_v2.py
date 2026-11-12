"""Version 2 routes. Legacy entry point and lyric cache remain shared."""
import re

from qqmusic_api import lyric, search, sync


def error(code, message):
    return {"code": code, "version": 2, "msg": message}


def handle(query, read_cache, write_cache, log_request, request_ip):
    action = query.get("action", "lyric" if query.get("id") else "search")
    if action == "search":
        keyword = query.get("key", "").strip()
        artist = query.get("artist", "").strip()
        if not keyword or len(keyword) > 200 or len(artist) > 200:
            return error(400, "key 必填且不能超过 200 字符，artist 不能超过 200 字符")
        try:
            page = int(query.get("page", "1"))
            limit = int(query.get("limit", "10"))
        except (ValueError, TypeError):
            return error(400, "page 和 limit 必须为整数")
        if not 1 <= page <= 100 or not 1 <= limit <= 30:
            return error(400, "page 范围为 1～100，limit 范围为 1～30")
        log_request("v2:search:" + keyword + "|" + artist, request_ip)
        results = sync(search.search_by_type(
            " ".join(part for part in (keyword, artist) if part),
            search.SearchType.SONG, num=limit, page=page, highlight=False,
        ))
        songs, seen = [], set()
        for song in results or []:
            mid = str(song.get("mid", ""))
            if not re.fullmatch(r"[A-Za-z0-9]{1,64}", mid) or mid in seen:
                continue
            seen.add(mid)
            album = song.get("album") or {}
            singers = [singer.get("name", "") for singer in song.get("singer", [])]
            album_mid = album.get("mid", "")
            cover = ("https://y.qq.com/music/photo_new/T002R500x500M000" + album_mid + ".jpg") if album_mid else ""
            songs.append({
                "id": "qq:" + mid,
                "source": "qqmusic",
                "name": song.get("name") or song.get("title", ""),
                "artist": " / ".join(filter(None, singers)),
                "artists": singers,
                "album": album.get("name") or album.get("title", ""),
                "duration": song.get("interval", 0),
                "cover": cover,
            })
        return {"code": 200, "version": 2, "action": "search", "key": keyword,
                "page": page, "limit": limit, "count": len(songs), "songs": songs}

    if action == "lyric":
        song_id = query.get("id", "").strip()
        match = re.fullmatch(r"qq:([A-Za-z0-9]{1,64})", song_id)
        if not match:
            return error(400, "id 必须为搜索结果返回的 qq:歌曲mid")
        log_request("v2:lyric:" + song_id, request_ip)
        cache_key = "v2:lyric:" + song_id
        data = read_cache(cache_key)
        if data is None:
            data = sync(lyric.get_lyric(mid=match.group(1), qrc=True, trans=True, roma=True))
            if not data or not data.get("lyric"):
                return error(404, "未找到该歌曲的歌词")
            data = dict(data)
            write_cache(cache_key, data)
            data["cache_hit"] = False
        return {**data, "code": 200, "version": 2, "action": "lyric", "id": song_id}

    return error(400, "action 只支持 search 或 lyric")
