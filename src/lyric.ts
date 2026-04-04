async function download_lyric(key: string,artist:string="") {
    console.log(key)
    const formData = new FormData();
    formData.append("key", key);
    formData.append("artist", artist);

    const json = await fetch("http://39.104.86.15/spotify_like_applemusic/background/get_lyric.py", {
        method: "POST",
        body: formData
    }).then(res => res.json());
    console.log(json);
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
    console.log(sum_arr)
    return sum_arr

}
export { download_lyric }