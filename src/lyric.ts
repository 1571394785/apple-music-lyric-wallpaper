import { trackProxy } from './lyric-proxy';
export const LYRIC_API = 'http://39.104.86.15/spotify_like_applemusic/background/get_lyric.py';

export interface SongMatch {
    id: string;
    name: string;
    artist: string;
    album: string;
    duration: number;
    cover: string;
}

async function requestApi(body: FormData | URLSearchParams, signal?: AbortSignal) {
    const tracking = trackProxy(LYRIC_API, body);
    let route;
    try {
        const response = await fetch(LYRIC_API, { method: 'POST', body, signal });
        if (!response.ok) throw new Error('暂时无法连接歌词服务，请重试');
        let data;
        try {
            data = await response.json();
        } catch {
            throw new Error('歌词服务暂时未返回有效结果，请稍后再试');
        }
        route = data?.proxy_route;
        if (!data || (data.code !== undefined && Number(data.code) !== 200)) {
            throw new Error(data?.msg || '歌词服务暂时不可用，请重试');
        }
        return data;
    } finally {
        tracking.finish(route);
    }
}

export async function searchSongs(key: string, artist: string, page: number, limit: number, signal?: AbortSignal): Promise<SongMatch[]> {
    const data = await requestApi(new URLSearchParams({ v: '2', action: 'search', key, artist, page: String(page), limit: String(limit) }), signal);
    if (!Array.isArray(data.songs)) throw new Error('搜索结果格式异常，请重试');
    return data.songs.filter((song: SongMatch) => typeof song.id === 'string' && typeof song.name === 'string');
}

export async function downloadLyricById(id: string, signal?: AbortSignal) {
    const data = await requestApi(new URLSearchParams({ v: '2', action: 'lyric', id }), signal);
    if (typeof data.lyric !== 'string' || !data.lyric) throw new Error('这首歌暂时没有歌词，请选择其他版本');
    return test(data.lyric);
}

async function download_lyric(key: string,artist:string="", signal?: AbortSignal) {
    const formData = new FormData();
    formData.append("key", key);
    formData.append("artist", artist);

    const json = await requestApi(formData, signal);
    if (typeof json.lyric !== 'string' || !json.lyric) throw new Error('未找到歌词');

    var a = test(json["lyric"]);
    return a
}
function test(ly: string) {
    // 用[分割字符串，获取第一个为数字
    let arr = ly.split('[');
    let sum_arr = [];
    let word_arr_finish = [];
    let word_arr = [];
    // let finial_arr = [
    //     {
    //         "words": [
    //             {
    //                 "startTime": 0,
    //                 "endTime": 6000,
    //                 "word": "准备是啊打算打撒但是是的发发"
    //             },

    //         ],
    //         "translatedLyric": "",
    //         "romanLyric": "",
    //         "startTime": 0,
    //         "endTime": 6000,
    //         "isBG": false,
    //         "isDuet": false
    //     },
    // ]
    for (let i = 0; i < arr.length; i++) {
        //   判断arr[i]开头是否为数字
        if (!isNaN(Number(arr[i][0]))) {
            var start_time = arr[i].split(',')[0];
            var end_time = arr[i].split(']')[0].split(',')[1];
            word_arr = arr[i].split(']')[1].split(')');
            word_arr_finish = [];
            for (let j = 0; j < word_arr.length; j++) {
                var word = word_arr[j].split('(')[0];
                try {
                    var word_start_time = word_arr[j].split('(')[1].split(',')[0]
                    var word_end_time = word_arr[j].split('(')[1].split(',')[1];
                    // console.log(word,word_start_time, word_end_time)
                } catch {
                    break
                }


                if (word_start_time == undefined || word_end_time == undefined) {
                    break;
                }
                word_arr_finish.push({
                    "startTime": parseInt(word_start_time),
                    "endTime": parseInt(word_end_time) + parseInt(word_start_time),
                    "word": word,

                })

            }

            sum_arr.push({
                "startTime": parseInt(start_time),
                "endTime": parseInt(end_time) + parseInt(start_time),
                "words": word_arr_finish,
                "translatedLyric": "",
                "romanLyric": "",
                "isBG": false,
                "isDuet": false
            })
        }

    }

    return sum_arr

}
export { download_lyric }
