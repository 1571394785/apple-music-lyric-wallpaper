# 歌词接口 v2

地址：`http://39.104.86.15/spotify_like_applemusic/background/get_lyric.py`

GET 与表单 POST 均可。POST 与 GET 同名参数同时出现时，以 POST 为准；暂不接受 JSON 请求体。

## 兼容旧版

不传 `v=2` 时仍使用原来的 `key`（歌名）、`artist`（可选）参数，保持原始歌词返回格式与歌名缓存逻辑。

```text
?key=晴天&artist=周杰伦
```

## 搜索歌曲

```text
?v=2&action=search&key=晴天&artist=周杰伦&limit=10&page=1
```

| 参数 | 说明 |
| --- | --- |
| v | 必须为 `2`，也兼容 `version=2` |
| action | `search`；未传 ID 时默认搜索 |
| key | 搜索关键词，必填，最多 200 字符 |
| artist | 可选歌手关键词，最多 200 字符 |
| limit | 每页数量，1～30，默认 10 |
| page | 页码，1～100，默认 1 |

返回示例（已省略部分歌曲）：

```json
{
  "code": 200,
  "version": 2,
  "action": "search",
  "key": "晴天",
  "page": 1,
  "limit": 10,
  "count": 10,
  "songs": [
    {
      "id": "qq:0039MnYb0qxYhV",
      "source": "qqmusic",
      "name": "晴天",
      "artist": "周杰伦",
      "artists": ["周杰伦"],
      "album": "叶惠美",
      "duration": 269,
      "cover": "https://y.qq.com/music/photo_new/T002R500x500M000000MkMni19ClKG.jpg"
    }
  ]
}
```

`count` 是本页实际返回数量，不是全站总数。无结果时返回 `code: 200`、`count: 0`、空 `songs`。`duration` 单位为秒。

## 按独立 ID 获取歌词

```text
?v=2&action=lyric&id=qq:0039MnYb0qxYhV
```

`id` 为搜索返回的稳定标识，由 `qq:` 加 QQ 音乐歌曲 mid 构成，原版、现场版等不同歌曲版本各自有独立 ID。它不依赖某次搜索列表中的序号，也不依赖临时服务端映射。

传入 ID 时 `action` 可省略。服务器直接按 ID 查询歌词，不进行歌名搜索。

成功返回顶层字段：`code: 200`、`version: 2`、`action: lyric`、`id`、`lyric`、`trans`、`roma`、`cache_hit`。歌词文本保留原始逐字格式。部分上游字段可能为空。

ID 歌词缓存与旧版歌名缓存隔离，沿用既有 SQLite 数据库与 15 天未使用过期策略。重复获取返回 `cache_hit: true`。

## 错误

错误码位于 JSON 的 `code` 字段；为兼容既有 CGI，HTTP 状态仍可能为 200。

| code | 说明 |
| --- | --- |
| 400 | 缺少关键词/ID、格式错误、分页越界、未知 action |
| 404 | 对应歌曲没有歌词 |
| 502 | QQ 上游调用失败（包括风控），由调用方再次请求 |

## 部署记录

已部署文件：

- `C:\网页\spotify_like_applemusic\background\get_lyric.py`
- `C:\网页\spotify_like_applemusic\background\lyric_api_v2.py`

原脚本备份位于服务器：`C:\Users\Administrator\AppData\Local\lyric-api-backups\20261112-173417-694269\get_lyric.py`。

没有更改原有歌词数据库结构，也没有处理或更换 QQ 上游风控策略。
