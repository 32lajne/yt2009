const express = require("express");
const yt2009 = require("./yt2009html");
const yt2009_embed = require("./yt2009embed")
const yt2009_channels = require("./yt2009channels")
const yt2009_playlists = require("./yt2009playlists");
const yt2009_home = require("./yt2009homepage");
const yt2009_utils = require("./yt2009utils");
const yt2009_search = require("./yt2009search");
const yt2009_static = require("./yt2009static");
const yt2009_videos_page = require("./yt2009videos");
const yt2009_channels_page = require("./yt2009channelspage")
const yt2009_warp_test = require("./yt2009warp");
const yt2009_warp_swf = require("./yt2009warpSWF")
const yt2009_history = require("./yt2009history");
const yt2009_subs = require("./yt2009subscriptions");
const yt2009_favorites = require("./yt2009favorites");
const yt2009_mobile = require("./yt2009mobile");
const yt2009_client_playlists = require("./yt2009clientplaylists");
const yt2009_annotations = require("./yt2009annotations");
const yt2009_templates = require("./yt2009templates");
const yt2009_xl = require("./yt2009xl");
const yt2009_cps = require("./yt2009cps")
const yt2009_constant = require("./yt2009constants.json")
const yt2009_languages = require("./language_data/language_engine")
const yt2009_quicklist = require("./yt2009quicklistserver")
const yt2009_captions = require("./yt2009captions")
const ryd = require("./cache_dir/ryd_cache_manager")
const video_rating = require("./cache_dir/rating_cache_manager")
const config = require("./config.json")
const child_process = require("child_process")

const https = require("https")
const fs = require("fs")
const app = express();
app.use(express.raw({
    "type": () => true
}))

if(config.env == "dev") {
    let launchTime = ""
    let date = new Date();
    launchTime = `launch time: ${date.getHours()}:${date.getMinutes() > 9 ? date.getMinutes() : "0" + date.getMinutes()}`
    app.listen(config.port, () => {
        console.log(`
    ==========

    yt2009 - dev

    ==========
    ${launchTime}
        `);
    });
} else if(config.env == "prod") {
    if(config.useSSL) {
        const server = https.createServer({
            cert: fs.readFileSync(config.SSLCertPath),
            key: fs.readFileSync(config.SSLKeyPath)
        }, app).listen(config.SSLPort)    
    }
    
    app.listen(config.port, () => {
        console.log(`
    ==========

    yt2009 - prod

    ==========
        `);
    });
}

app.get('/back/*', (req,res) => {
    res.redirect("https://github.com/ftde0/yt2009")
})
app.get('/node_modules/*', (req,res) => {
    res.sendStatus(404)
})

app.get('/', (req,res) => {
    if(!yt2009_utils.isAuthorized(req)) {
        if(yt2009_utils.isTemplocked(req)) {
            res.redirect("/t.htm")
            return;
        }
        res.redirect("/auth.html")
        return;
    }
    if(config.env == "dev") {
        console.log(`(${yt2009_utils.get_used_token(req)}) mainpage ${Date.now()}`)
    }
    yt2009_home(req, res)
})

/*
======
strona oglądania
======
*/

app.get("/watch", (req, res) => {
    if(!yt2009_utils.isAuthorized(req)) {
        if(yt2009_utils.isTemplocked(req)) {
            res.redirect("/t.htm")
            return;
        }
        res.redirect("/unauth.htm")
        return;
    }
    req = yt2009_utils.addFakeCookie(req)

    let id = req.query.v
    let useFlash = false;
    let resetCache = false;
    id = id.substring(0, 11)
    if(id.length !== 11 || id.includes("yt2009")) {
        res.send(`[yt2009] niepoprawne id? / invalid id?`)
        return;
    }

    if(req.headers.cookie.includes("useFeather")) {
        useFeather = true;
    }

    // flash
    if(req.originalUrl.includes("&f=1") ||
        req.headers.cookie.includes("f_mode")) {
        useFlash = true;
    }

    // reset flag
    if(req.originalUrl.includes("resetflags=1")) {
        flags = ""
    }

    // reset cache
    if(req.query.resetcache == "1") {
        resetCache = true;
    }

    // sub lista
    let subList = yt2009_utils.get_subscriptions(req);

    yt2009.fetch_video_data(id, (data) => {
        if(!data) {
            res.send(`[yt2009] zepsuło się<br>
            możliwe powody:<br>- film nie istnieje/jest prywatny<br>
            - filmu nie można pobrać (paywall, ograniczenie wiekowe itp.)<br>
            <br>----<br>
            something went wrong<br>
            possible reasons:<br>
            - the video does not exist<br>
            - the video cannot be downloaded (paywalled, age restricted etc.)`)
            return;
        }
        if(req.headers.cookie.includes("exp_hd")) {
            yt2009.get_qualities(id, (qualities) => {
                yt2009.applyWatchpageHtml(data, req, (code => {
                    code = yt2009_languages.apply_lang_to_code(code, req)
                    res.send(code)
                }), qualities)
            })
        } else {
            yt2009.applyWatchpageHtml(data, req, (code => {
                code = yt2009_languages.apply_lang_to_code(code, req)
                res.send(code)
            }), [])
        }
    }, req.headers["user-agent"],
        yt2009_utils.get_used_token(req),
        useFlash, 
        resetCache)
})


app.get("/watch_feather", (req, res) => {
    res.send(`[yt2009] watch_feather nie jest już wspierane. 
    włącz tryb Feather z TestTube, aby użyć Feather.<br><br>
    watch_feather is not supported anymore.
    turn on the Feather mode from TestTube to use Feather.<br><br>
    <a href="/feather_beta">feather &gt;&gt;</a>`)
})

/*
======
video response
======
*/
app.post("/videoresponse_load", (req, res) => {
    if(!yt2009_utils.isAuthorized(req)) {
        res.redirect("/unauth.htm")
        return;
    }
    if(!req.body) {
        res.send("[yt2009] no query in body")
        return;
    }
    let query = req.body.toString().trimStart().split("\n").join("").trimEnd()
    // remove some common music suffixes in case of a wayback_features fail
    query = query
    .replace("(Official Music Video)", "")
    .replace("(Official Video)", "")
    
    let responsesHTML = yt2009_templates.videoResponsesBeginning

    yt2009_search.get_search(
        `"Re: ${query}"`,
        "only_old;author_old_names;remove_username_space;username_asciify",
        "",
    (data) => {
        let responseCount = 0;
        data.forEach(entry => {
            if(entry.type == "video"
            && entry.title.startsWith(`Re: ${query}`)) {
                responsesHTML += `\n${yt2009_templates.videoResponse(
                    entry.id,
                    entry.time,
                    entry.author_name,
                    entry.author_url,
                    req.protocol
                )}`
                responseCount++;
            }
        })

        responsesHTML += `\n${yt2009_templates.videoResponsesEnd}`
        if(responseCount == 0) {
            responsesHTML = `No Video Responses.
            <!--that text is just an approximation of how it would
             have been in 2009. but if you know how it actually
              did let me know. thanks!!-->`
        }
        res.send(responsesHTML)
    }, 
        `videoresponse-${yt2009_utils.get_used_token(req)}`,
        false)
})

/*
======
more from: ładowanie na nowo
======
*/
app.get("/morefrom_load", (req, res) => {
    let channelFlags = req.headers.cookie || ""
    if(channelFlags.includes("channel_flags")) {
        channelFlags = channelFlags.split("channel_flags")[1]
                       .split(";")[0]
    }
    let useOnlyOld = false;
    let onlyOldQuery = ""
    if(channelFlags.includes("only_old")) {
        useOnlyOld = true;
        onlyOldQuery = yt2009_search.handle_only_old(
            channelFlags.split(":").join(";")
        )
    }
    let videosHTML = ``


    // default videos (without only_old OR if no videos with only_old)
    function fetchDefaultVideos() {
        yt2009_channels.main({"path": req.headers.channel, 
        "headers": {"cookie": "auth=" + yt2009_utils.get_used_token(req)},
        "query": {"f": 0}}, 
        {"send": function(data) {
            if(data.videos) {
                data.videos.forEach(video => {
                    if(req.headers.source.includes(video.id)) return;
                    videosHTML += yt2009_templates.relatedVideo(
                        video.id, video.title, req.protocol, "",
                        video.views, "#", "", channelFlags
                    )
                })
            }
    
            res.send(videosHTML)
        }}, "", true)
    }

    if(useOnlyOld) {
        // use only_old as video source
        if(!req.headers.name) {
            res.status(400).send("no name header specified");
            return;
        }
        let onlyOldVideos = []
        let name = req.headers.name.trim()
        let query = `"${name}" ${onlyOldQuery}`
        yt2009_search.get_search(query, channelFlags, "", (results => {
            // actual results
            results.forEach(result => {
                if(result.type == "video"
                && (name.includes(
                    result.author_name.split(" ").join("")
                ) || name == result.author_name)) {
                    onlyOldVideos.push(result)
                }
            })
            if(!onlyOldVideos[0]) {
                // no videos, fetch default
                fetchDefaultVideos();
                return;
            } else {
                // format only_old
                onlyOldVideos.forEach(video => {
                    if(req.headers.source.includes(video.id)) return;
                    videosHTML += yt2009_templates.relatedVideo(
                        video.id, video.title, req.protocol, "",
                        video.views, "#", "", channelFlags
                    )
                })
                res.send(videosHTML)
            }
        }), yt2009_utils.get_used_token(req), false)
    } else {
        // use default channel videos as video source
        fetchDefaultVideos()
    }

})

/*
======
adnotacje
======
*/
app.get("/json_annotations", (req, res) => {
    yt2009_annotations.get(req, res)
})

// adnotacje f_mode
app.get("/read2", (req, res) => {
    yt2009_annotations.getFmode(
        req.query.video_id,
        yt2009_utils.get_used_token(req),
        (xml => {
            res.send(xml)
        }
    ))
})

// endpoint /profile używany przez adnotacje
app.get("/profile", (req, res) => {
    if(!req.query.user) {
        res.send("[yt2009] brak parametru user. / no user parameter.")
        return;
    }
    res.redirect("/user/" + req.query.user)
})

/*
======
subtitles
======
*/
app.get("/timedtext", (req, res) => {
    if(!yt2009_utils.isAuthorized(req)) {
        res.status(403).send()
        return;
    }
    yt2009_captions.main(req, res)
})


/*
======
generator embedów
======
*/
app.get("/embed_generate", (req, res) => {
    res.send(
        fs.readFileSync("../static_pages/cropped/embed_gen.html").toString()
    );
})

/*
======
video rating
======
*/
app.post("/video_rate", (req, res) => {
    if(!yt2009_utils.isAuthorized(req)) {
        res.sendStatus(401)
        return;
    }
    if(!req.headers.source) {
        res.sendStatus(400)
        return;
    }
    let token = yt2009_utils.get_used_token(req);
    let rating = req.headers.rating || 5;
    let id = req.headers.source.split("v=")[1].split("&")[0].split("#")[0]
    video_rating.setRating(id, token, rating)
    res.sendStatus(200)
})


/*
======
return youtube dislike
======
*/
app.get("/ryd_request", (req, res) => {
    if(!yt2009_utils.isAuthorized(req)) {
        res.redirect("/unauth.htm")
        return;
    }

    let id = req.headers.source.split("v=")[1].split("&")[0]
    ryd.fetch(id, (data) => {
        let toSend = data.toString();
        if(!toSend.includes(".5")) {
            toSend += ".0"
        } 
        res.send(toSend)
    })
})

/*
======
wyszukiwarka
======
*/

app.get("/results", (req, res) => {
    if(!yt2009_utils.isAuthorized(req)) {
        if(yt2009_utils.isTemplocked(req)) {
            res.redirect("/t.htm")
            return;
        }
        res.redirect("/unauth.htm")
        return;
    }
    let query = req.query.search_query
    let flags = req.query.flags || ""
    let params = req.query.sp || ""
    let resetCache = false;
    // reset cache
    if(req.query.resetcache == "1") {
        resetCache = true;
    }

    // strony
    if(req.query.page) {
        params += "&page=" + req.query.page
    }

    try {
        req.headers.cookie.split(";").forEach(cookie => {
            if(cookie.trimStart().startsWith("results_flags")) {
                flags += cookie.trimStart().replace("results_flags=", "")
                                            .split(":").join(";")
            }
        })
    }
    catch(error) {}
    flags += ";"
    try {
        req.headers.cookie.split(";").forEach(cookie => {
            if(cookie.trimStart().startsWith("global_flags=")) {
                flags += cookie.trimStart().replace("global_flags=", "")
                                            .split(":").join(";")
            }
        })
    }
    catch(error) {}

    // reset flag
    if(req.originalUrl.includes("resetflags=1")) {
        flags = ""
    }

    if(query.length == 0) {
        res.send(`[yt2009] wyszukiwania powinny mieć co najmniej 1 znak
                / searches should have at least 1 character`)
        return;
    }

    if(req.query.page && parseInt(req.query.page) > 1) {
        // page looping
        yt2009_search.loopPages(
            query,
            params,
            parseInt(req.query.page),
            (data) => {
                res.send(yt2009_search.apply_search_html(
                    data, query, flags,
                    req.originalUrl,
                    req.protocol, params,
                    req.headers["user-agent"]
                ))
            },
            flags.includes("only_old")
        )
    } else {
        // normal search
        yt2009_search.get_search(
            query,
            decodeURIComponent(flags),
            params,
            (data) => {
                if(!data) {
                    res.send(
                        `[yt2009] coś poszło nie tak w parsowaniu wyników
                        / something went wrong while parsing the results`)
                    return;
                }
                res.send(yt2009_search.apply_search_html(
                    data, query, flags,
                    req.originalUrl,
                    req.protocol, params,
                    req.headers["user-agent"]
                ))
            },
            yt2009_utils.get_used_token(req), resetCache)
    }

    
})

/*
======
xl
======
*/
app.get("/xl", (req, res) => {
    if(!yt2009_utils.isAuthorized(req)) {
        res.send("[yt2009] please authorize to use XL.")
        return;
    }
    let url = "/xl/index.htm"
    if(req.query.html5 == 1) {
        url += "?html5=1"
    }
    res.redirect(url)
})

app.get("/xl/console_browse", (req, res) => {
    yt2009_xl.get_mainpage(req, res)
})

app.get("/xl/console_related", (req, res) => {
    yt2009_xl.get_related(req, res)
})

app.get("/xl/console_results", (req, res) => {
    yt2009_xl.get_search(req, res)
})

app.get("/xl/console_profile", (req, res) => {
    yt2009_xl.get_profile(req, res)
})

app.get("/xl/console_profile_videos", (req, res) => {
    yt2009_xl.get_profile(req, res)
})

app.get("/apiplayer", (req, res) => {
    res.redirect("/xl/apiplayer.swf")
})

app.get("/swf/apiplayer.swf", (req, res) => {
    res.redirect("/xl/apiplayer-f.swf")
})

app.get("/get_video_info", (req, res) => {
    yt2009.fetch_video_data(req.query.video_id, (data => {
        let qualities = require("./cache_dir/qualitylist_cache_manager")
                        .read()[req.query.video_id] || [];
        let fmt_list = ""
        let fmt_stream_map = ""
        let fmt_map = ""
        qualities.forEach(quality => {
            switch(quality) {
                case "720p": {
                    fmt_list += "22/1280x720/9/0/115,"
                    fmt_map += "22/2000000/9/0/115,"
                    fmt_stream_map += `22|http://${config.ip}:${
                        config.port
                    }/exp_hd?video_id=${req.query.video_id},`
                    break;
                }
                case "480p": {
                    fmt_list += "35/854x480/9/0/115,"
                    fmt_map += "35/0/9/0/115,"
                    fmt_stream_map +=  `35|http://${config.ip}:${
                        config.port
                    }/get_480?video_id=${req.query.video_id},`
                    break;
                }
            }
        })
        fmt_list += "5/640x360/9/0/115"
        fmt_map += "5/0/7/0/0"
        fmt_stream_map += `5|http://${config.ip}:${
            config.port
        }/assets/${data.id}.mp4`
res.send(`status=ok
length_seconds=1
keywords=a
vq=None
muted=0
avg_rating=5.0
thumbnail_url=${
    encodeURIComponent(
        `${req.protocol}://i.ytimg.com/vi/${req.query.video_id}/hqdefault.jpg`
    )
}
allow_ratings=1
hl=en
ftoken=
allow_embed=1
fmt_map=${encodeURIComponent(fmt_map)}
fmt_url_map=${encodeURIComponent(fmt_stream_map)}
token=amogus
plid=amogus
track_embed=0
author=${data.author_name}
title=${data.title}
video_id=${req.query.video_id}
fmt_list=${encodeURIComponent(fmt_list)}
fmt_stream_map=${encodeURIComponent(fmt_stream_map)}`.split("\n").join("&"))
    }), "", "", false, false)
})

app.get("/xl/embed", (req, res) => {
    yt2009_xl.xl_embed(req, res)
})

/*
======
quicklist
======
*/
app.get("/ql_html_template", (req, res) => {
    res.send(yt2009_templates.quicklistHTMLTemplate)
})
app.get("/watch_queue", (req, res) => {
    res.send(yt2009_quicklist.apply(req, res))
})

/*
======
cps.swf/mobile videoinfo
======
*/
app.get("/feeds/api/videos/", (req, res) => {
    if(!req.query.q) {
        yt2009_mobile.videoData(req, res)
        return;
    }
    yt2009_cps.get_search(req, res)
})

/*
======
cpb.swf (flash embed playlists)
======
*/
app.get("/feeds/api/playlists/*", (req, res) => {
    yt2009_playlists.create_cpb_xml(req, res)
})

/*
======
embed
======
*/

app.get("/embed/*", (req, res) => {
    yt2009_embed(req, res)
})
app.get("/embedF/*", (req, res) => {
    yt2009_embed(req, res)
})
app.get("/generate_gradient", (req, res) => {
    const child_process = require("child_process")
    let color = req.query.c.substring(0, 6).replace(/[^0-9a-zA-Z]/g, "")
    if(fs.existsSync(`../player-imgs/embed-bgs/user-gen/${color}.png`)) {
        // kolorek już mamy wygenerowany, callback
        res.redirect(`/player-imgs/embed-bgs/user-gen/${color}.png`)
    } else {
        // generujemy na nowo
        child_process.exec(`magick -size 1x25 gradient:"#ffffff"-"#${color}" ${__dirname}/../player-imgs/embed-bgs/user-gen/${color}.png`, (error, stdout, stderr) => {
            res.redirect(`/player-imgs/embed-bgs/user-gen/${color}.png`)
        })
    }
})
app.get("/embed_get_endscreen", (req, res) => {
    let endscreen_html = `
    <span class="endscreen-arrow-left" onclick="endscreen_section_change(-1)"></span>
    <span class="endscreen-arrow-right" onclick="endscreen_section_change(1)"></span>
    <div class="buttons yt-center">
        <div class="button-share">
            <img src="/player-imgs/share.png"/>
            <h2 style="margin-top: 5px;">Share</h2>
        </div>
        <div class="button-replay" onclick="videoReplay();">
            <img src="/player-imgs/replay.png"/>
            <h2 style="margin-top: 5px;">Replay</h2>
        </div>
    </div>`

    let endscreen_section_index = 0;
    let endscreen_section_html = `              <div class="endscreen-section" style="opacity: 1;">
    `

    yt2009.get_related_videos(req.headers.source.split("embed/")[1].substring(0, 11), (related) => {
        related.forEach(video => {
            if(yt2009_utils.time_to_seconds(video.length) >= 1800) return;
            endscreen_section_html += `
            <div class="endscreen-video" onclick="videoNav('${video.id}')">
                <div class="endscreen-video-thumbnail">
                    <img src="//i.ytimg.com/vi/${video.id}/hqdefault.jpg" width="80" height="65"/>
                    <div class="video-time" style="float: right;"><a href="">${video.length}</a></div>
                </div>
                <div class="endscreen-video-info">
                    <h3 style="max-width: 0px;overflow: hidden;" class="endscreen-video-title">${video.title.length > 80 ? video.title.substring(0, 80) + "..." : video.title}</h3>
                    <h3 class="gr"style="height: 17px"></h3>
                    <h3 class="gr">From: <span class="text-light">${video.creatorName}</span></h3>
                    <h3 class="gr" style="margin-top: 2px !important;">Views: <span class="text-light">${video.views.replace(/[^0-9]/g, "")}</span></h3>
                    <img src="/assets/site-assets/pixel-vfl73.gif" class="endscreen-video-star"/>
                </div>
            </div>`
    
    
            endscreen_section_index++;
            if(endscreen_section_index % 2 == 0) {
                endscreen_section_html += `
                    </div>`
                endscreen_html += endscreen_section_html;
                endscreen_section_html = `    
                    <div class="endscreen-section hid"  style="opacity: 0;">
        `
            }
        })
        endscreen_html += `
        
        <style>
        .endscreen-video, .gr {
            color: #4d4b46 !important;
        }

        .endscreen-video {
            background-image: url(/player-imgs/darker-bg.png);
            background-size: contain;
            -moz-background-size: contain;
        }
        </style>
        `
        res.send(endscreen_html)
    }, "", true)
})

/*
======
kanały
======
*/
let channel_endpoints = [
    "/channel/*",
    "/user/*",
    "/c/*",
    "/@*"
] 
channel_endpoints.forEach(channel_endpoint => {
    app.get(channel_endpoint, (req, res) => {
        if(!yt2009_utils.isAuthorized(req)) {
            if(yt2009_utils.isTemplocked(req)) {
                res.redirect("/t.htm")
                return;
            }
            res.redirect("/unauth.htm")
            return;
        }
        let flags = decodeURIComponent(req.query.flags) || ""
        try {
            req.headers.cookie.split(";").forEach(cookie => {
                if(cookie.trimStart().startsWith("channel_flags")) {
                    flags += cookie.trimStart()
                            .replace("channel_flags=", "")
                            .split(":").join(";")
                }
            })
        }
        catch(error) {}
        flags += ";"
        try {
            req.headers.cookie.split(";").forEach(cookie => {
                if(cookie.trimStart().startsWith("global_flags=")) {
                    flags += cookie.trimStart()
                            .replace("global_flags=", "")
                            .split(":").join(";")
                }
            })
        }
        catch(error) {}
    
        // reset flag
        if(req.originalUrl.includes("resetflags=1")) {
            flags = ""
        }
    
        yt2009_channels.main(req, res, flags)
    })
})

app.get("/playnav_get_comments", (req, res) => {
    yt2009_channels.playnav_get_comments(req, res)
})

app.get("/channel_fh264_getvideo", (req, res) => {
    if(!fs.existsSync("../assets/" + req.query.v + ".mp4")) {
        yt2009_utils.saveMp4(req.query.v, (vid) => {
            let vidLink = vid.replace("../", "/")
            if(vidLink.includes("assets/")) {
                vidLink += ".mp4"
            }
            res.redirect(vidLink)
        })
    } else {
        res.redirect("/assets/" + req.query.v + ".mp4")
    }
    
})

/*
======
playlisty
======
*/
let playlist_endpoints = ["/playlist", "/view_play_list"]
playlist_endpoints.forEach(playlistEndpoint => {
    app.get(playlistEndpoint, (req, res) => {
        if(!yt2009_utils.isAuthorized(req)) {
            res.redirect("/unauth.htm")
            return;
        }
        let playlistId = (req.query.list || req.query.p)
        yt2009_playlists.parsePlaylist(playlistId, (list) => {
            res.send(yt2009_playlists.applyPlaylistHTML(list, req))
        })
    })
})

app.get("/channel_get_playlist", (req, res) => {
    if(!yt2009_utils.isAuthorized(req)) {
        res.redirect("/unauth.htm")
        return;
    }
    let videosHTML = ``
    yt2009_playlists.parsePlaylist(req.headers.id, (list) => {
        let video_index = 0;
        list.videos.forEach(video => {
            videosHTML += `
            <div class="playnav-item playnav-video ${video_index == 0 ? "selected" : ""}" id="playnav-video-${video.id}" onclick="switchVideo(this)">
                <div class="content">
                    <div class="playnav-video-thumb link-as-border-color">
                        <a class="video-thumb-90 no-quicklist" href="#"><img title="${video.title}" src="${video.thumbnail}" class="vimg90 yt-uix-hovercard-target" alt="${video.title}"></a>
            
                    </div>
                    <div class="playnav-video-info">
                        <a href="#" class="playnav-item-title ellipsis"><span class="video-title-${video.id}">${video.title}</span></a>
                        <div class="metadata video-meta-${video.id}"></div>
                        <div class="video-ratings-${video.id} hid">0</div>
                    </div>
                </div>
            </div>`

            video_index++;
        })

        res.send(videosHTML)
    })
})
app.get("/refetch_playlist_watch", (req, res) => {
    let videosHTML = ``
    let playlistId = req.headers.source.split("list=")[1].split("&")[0].split("#")[0]
    yt2009_playlists.parsePlaylist(playlistId, (list) => {
        let video_index = 0;
        list.videos.forEach(video => {
            videosHTML += `
            <div class="video-entry ${video.id == req.headers.source.split("v=")[1].split("&")[0].split("#")[0] ? "watch-ppv-vid" : ""}">
                <div class="v90WideEntry">
                    <div class="v90WrapperOuter">
                        <div class="v90WrapperInner">
                            <a href="/watch?v=${video.id}&list=${playlistId}" class="video-thumb-link" rel="nofollow"><img title="${video.title}" thumb="${req.protocol}://i.ytimg.com/vi/${video.id}/hqdefault.jpg" src="${req.protocol}://i.ytimg.com/vi/${video.id}/hqdefault.jpg" class="vimg90" qlicon="${video.id}" alt="${video.title}}"></a>
        
                            <div class="addtoQL90"><a href="#" ql="${video.id}" title="Add Video to QuickList"><button title="" class="master-sprite QLIconImg"></button></a>
                                <div class="hid quicklist-inlist"><a href="#">Added to Quicklist</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="video-main-content">
                    <div class="video-mini-title">
                    <a href="/watch?v=${video.id}&list=${playlistId}" rel="nofollow">${video.title}</a></div>
                    <div class="video-username"><a href="${video.uploaderUrl}">${video.uploaderName}</a>
                    </div>
                </div>
                <div class="video-clear-list-left"></div>
            </div>`

            video_index++;
        })

        res.send(videosHTML)
    })
})


/*
======
komentarze pod filmem
======
*/
app.get("/get_more_comments", (req, res) => {
    let token = req.headers.continuation
    let id = req.headers.source.split("watch?v=")[1].split("&")[0]
    let flags = ""
    try {
        req.headers.cookie.split(";").forEach(cookie => {
            if(cookie.trimStart().startsWith("watch_flags=")) {
                flags += cookie.trimStart().replace("watch_flags=", "").split(":").join(";")
            }
        })
        flags += req.headers.url_flags.split("flags=")[1].split("&")[0];
    }
    catch(error) {}

    let comment_html = "";

    yt2009.request_continuation(token, id, flags, (data) => {
        data.forEach(comment => {
            if(comment.continuation) {
                comment_html += `;yt_continuation=${comment.continuation}`
            } else {
                comment_html +=  `
                <div class="watch-comment-entry">
                    <div class="watch-comment-head">
                        <div class="watch-comment-info">
                            <a class="watch-comment-auth" href="${comment.authorUrl}" rel="nofollow">${comment.authorName}</a>
                            <span class="watch-comment-time"> (${comment.time}) </span>
                        </div>
                        <div class="watch-comment-voting">
                            <!--<span class="watch-comment-score watch-comment-gray">&nbsp;0</span>-->
                            <a href="#"><button class="master-sprite watch-comment-down" title="Poor comment"></button></a>
                            <a href="#"><button class="master-sprite watch-comment-up" title="Good comment"></button></a>
                            <span class="watch-comment-msg"></span>
                        </div>
                        <span class="watch-comment-spam-bug">Marked as spam</span>
                        <div class="watch-comment-action">
                            <a>Reply</a>
                        </div>
                        <div class="clearL"></div>
                    </div>
        
                    <div>
                        <div class="watch-comment-body">
                            <div>
                                ${comment.content}
                            </div>
                        </div>
                        <div></div>
                    </div>
                </div>`
            }
        })
        res.send(comment_html)
    })
})

/*
======
warp! (html)
======
*/
app.get("/warp", (req, res) => {
    yt2009_warp_test.use(req, res)
})
app.get("/warp_continuation", (req, res) => {
     yt2009_warp_test.get_other_videos(req, res)
})

/*
======
warp! (swf)
======
*/
app.get("/api2_rest", (req, res) => {
    yt2009_warp_swf.get_video(req, res)
})
app.get("/get_awesome", (req, res) => {
    yt2009_warp_swf.get_related(req, res)
})
app.get("/next_awesome", (req, res) => {
    yt2009_warp_swf.get_related(req, res)
})
app.get("/get_video", (req, res) => {
    yt2009_warp_swf.get_flv(req, res)
})


/*
======
/videos, /videos rss /channels
======
*/
app.get("/videos", (req, res) => {
    yt2009_videos_page.apply(req, res)
})
app.get("/channels", (req, res) => {
    yt2009_channels_page.apply(req, res)
})
app.get("/videos-rss", (req, res) => {
    yt2009_videos_page.create_rss(req, res)
})

/*
======
historia, suby, ulubione, playlisty
======
*/
app.get("/my_history", (req, res) => {
    yt2009_history.apply(req, res)
})
app.get("/my_favorites", (req, res) => {
    yt2009_favorites.apply(req, res)
})
app.get("/my_subscriptions", (req, res) => {
    yt2009_subs.apply(req, res)
})
app.get("/subscriptions_new_videos", (req, res) => {
    yt2009_subs.fetch_new_videos(req, res, false)
})
app.get("/my_playlists", (req, res) => {
    yt2009_client_playlists.apply(req, res)
})


/*
======
strony statyczne (np. z footera)
======
*/
let static_sites = {
    "/t/contact_us": "contact_us.html",
    "/press_room": "press_room.html",
    "/partners": "partner.html",
    "/t/content_management": "content_management.html",
    "/t/yt_handbook_home": "handbook_home.html",
    "/t/community_guidelines": "guidelines.html",
    "/t/creators_corner": "creators_corner.html",
    "/t/privacy": "privacy.html",
    "/t/dmca_policy": "dmca.html",
    "/feather_beta": "feather_beta.html",
    "/testtube": "test.html",
    "/my_videos_upload": "upload.html",
    "/warp_speed": "warp_speed.html",
    "/warp_speed_en": "warp_speed_en.html",
    "/t/new_viewing_experience": "new_viewing_experience.html"
}
for(let site in static_sites) {
    app.get(site, (req, res) => {
        yt2009_static.createSite(static_sites[site], req, res)
    })
}
app.get("/toggle_f", (req, res) => {
    res.redirect("/toggle_f.htm")
})

/*
======
odmów dostępu jak ktoś bez autoryzacji próbuje wejść na strony typu index.htm
======
*/
let html_files = [
    "/channelpage.htm",
    "/channels.htm",
    "/history.htm",
    "/index.htm",
    "/playlist.htm",
    "/result-template.html",
    "/search-generic-page.htm",
    "/subscriptions.htm",
    "/videos.htm",
    "/warp.html",
    "/watch.html",
    "/watch_feather.html",
]
html_files.forEach(file => {
    app.get(file, (req, res) => {
        if(!yt2009_utils.isAuthorized(req)) {
            console.log(`(unathorized ${req.ip}/${req.headers["user-agent"]}) access attempt ${file}`)
            res.redirect("/unauth.htm")
            return;
        }

        res.send(
            require("fs").readFileSync(`${__dirname}/../${file}`).toString()
        )
    })
})

/*
======
osobny entry na yt2009_flags aby wspierać fmode
======
*/
app.get("/yt2009_flags.htm", (req, res) => {
    if(!yt2009_utils.isAuthorized(req)) {
        if(yt2009_utils.isTemplocked(req)) {
            res.redirect("/t.htm")
            return;
        }
        res.redirect("/unauth.htm")
        return;
    }
    
    let flagsPage = require("fs").readFileSync(
        `${__dirname}/../yt2009_flags.htm`
    ).toString()

    if((req.headers.cookie || "").includes("f_mode=on")) {
        flagsPage = flagsPage.replace(
            `<!--yt2009_f-->`,
            `<script src="/assets/site-assets/yt2009_flags_f.js"></script>`
        )
        flagsPage = flagsPage.replace(
            `onclick="update_cookies();"`,
            `onclick="update_cookies_f();"`
        )
    }

    res.send(flagsPage)
})

app.use(express.static("../"))


/*
======
legacy ustawianie autoryzacji (tylko pod testy)
======
*/
app.get("/test_only_legacy_cookie_auth", (req, res) => {
    res.send(`<script>document.cookie = "auth=${req.query.token}; Path=/; expires=Fri, 31 Dec 2066 23:59:59 GMT";</script>`)
})

/*
======
eksperymentalne 720p
======
*/

const fetch = require("node-fetch")
app.get("/exp_hd", (req, res) => {
    let id = req.query.video_id.substring(0, 11)

    // callback mp4 jak już mamy
    if(fs.existsSync(`../assets/${id}-hd.mp4`)) {
        res.redirect(`/assets/${id}-hd.mp4`)
    } else {
        // download hd video and merge with main mp4 audio
        let writeStream = fs.createWriteStream(`../assets/${id}-hd-video.mp4`)
        writeStream.on("finish", () => {
            let videoFilename = `${__dirname}/../assets/${id}-hd-video.mp4`
            let audioFilename = `${__dirname}/../assets/${id}.mp4`
            let targetFilename = `${__dirname}/../assets/${id}-hd.mp4`
            let cmd = `ffmpeg -i ${videoFilename} -i ${audioFilename} -c:v copy -c:a copy -map 0:v -map 1:a -ab 192000 ${targetFilename}`
            child_process.exec(cmd, (error, stdout, stderr) => {
                res.redirect(`/assets/${id}-hd.mp4`)
                fs.unlinkSync(videoFilename)
            })
        })
        require("ytdl-core")(`https://youtube.com/watch?v=${id}`, {
            "quality": 136
        })
        .pipe(writeStream)
    }
})

/*
======
480p (HQ) jako część exp_hd
======
*/
app.get("/get_480", (req, res) => {
    let id = req.query.video_id.substring(0, 11)
    if(fs.existsSync(`../assets/${id}-480.mp4`)) {
        res.redirect(`/assets/${id}-480.mp4`)
    } else {
        let writeStream = fs.createWriteStream(`../assets/${id}-480-temp.mp4`)
        writeStream.on("finish", () => {
            let videoFilename = `${__dirname}/../assets/${id}-480-temp.mp4`
            let audioFilename = `${__dirname}/../assets/${id}.mp4`
            let targetFilename = `${__dirname}/../assets/${id}-480.mp4`
            let cmd = `ffmpeg -i ${videoFilename} -i ${audioFilename} -c:v copy -c:a copy -map 0:v -map 1:a -ab 192000 ${targetFilename}`
            child_process.exec(cmd, (error, stdout, stderr) => {
                res.redirect(`/assets/${id}-480.mp4`)
                fs.unlinkSync(videoFilename)
            })
        })
        require("ytdl-core")(`https://youtube.com/watch?v=${id}`, {
            "quality": 135
        })
        .pipe(writeStream)
    }
})

/*
======
basic mobilny widok
======
*/

app.get("/mobile", (req, res) => {
    yt2009_mobile.create_homepage(req, res)
})
app.get("/mobile/watch", (req, res) => {
    yt2009_mobile.create_watchpage(req, res)
})
app.get("/mobile/results", (req, res) => {
    yt2009_mobile.search(req, res)
})
app.get("/mobile/view_comment", (req, res) => {
    yt2009_mobile.view_comments(req, res)
})
app.get("/mobile/profile", (req, res) => {
    //yt2009_mobile.create_watchpage(req, res)
    res.send("łot")
})
app.get("/mobile/create_rtsp", (req, res) => {
    let id = req.query.v
    let noSound = req.query.muted ? true : false
    if(!id) {
        res.send("no video id param, cannot start stream.")
        return;
    }
    yt2009_mobile.setup_rtsp(id, noSound, res)
})

/*
======
mobile (apk) endpoints
======
*/
app.post("/youtube/accounts/registerDevice", (req, res) => {
    let deviceId = ""
    while(deviceId.length !== 5) {
        deviceId += "qwertyuiopasdfghjklzxcvbnm1234567890".split("")
                    [Math.floor(Math.random() * 36)]
    }
    res.send(`DeviceId=${deviceId}
DeviceKey=ULxlVAAVMhZ2GeqZA/X1GgqEEIP1ibcd3S+42pkWfmk=
#yt2009 - devicekey created with aes secret from 2.3.4 apk`)
})
app.get("/feeds/api/standardfeeds/*", (req, res) => {
    yt2009_mobile.feeds(req, res)
})
app.get("/feeds/api/videos/*/comments", (req, res) => {
    yt2009_mobile.apkVideoComments(req, res)
})
app.get("/feeds/api/videos/*/related", (req, res) => {
    yt2009_mobile.apkVideoRelated(req, res)
})
app.get("/feeds/api/videos/*", (req, res) => {
    if(!req.query.q) {
        yt2009_mobile.videoData(req, res)
        return;
    }
})
app.get("/feeds/api/users/*/recommendations", (req, res) => {
    res.redirect("/feeds/api/standardfeeds/recently_featured")
})
app.get("/feeds/api/users/default/*", (req, res) => {
    if(req.headers["authorization"]) {
        res.send(yt2009_templates.gdata_feedStart
                + yt2009_templates.gdata_feedEnd)
    }
})

app.get("/feeds/api/users/*/uploads", (req, res) => {
    yt2009_mobile.userVideos(req, res)
})
app.get("/feeds/api/users/*/playlists/*", (req, res) => {
    yt2009_mobile.userPlaylistStart(req, res)
})
app.get("/feeds/api/users/*/playlists", (req, res) => {
    yt2009_mobile.userPlaylists(req, res)
})
app.get("/feeds/api/users/*/favorites", (req, res) => {
    yt2009_mobile.userFavorites(req, res)
})
app.get("/feeds/api/users/*", (req, res) => {
    yt2009_mobile.userInfo(req, res)
})
app.get("/feeds/api/events", (req, res) => {
    yt2009_mobile.apkUserEvents(req, res)
})
app.get("/schemas/2007/categories.cat", (req, res) => {
    res.send(fs.readFileSync("../assets/site-assets/gdata_categories.xml")
               .toString())
})

/*
======
zapisywanie clientside playlist aby dało się je odtwarzać
======
*/
app.post("/create_playlist", (req, res) => {
    let c = true;
    if(!yt2009_utils.isAuthorized(req)) {
        res.status(401).send("")
        return;
    }

    // sprawdzamy czy już nie ma takiej playlisty, jak tak to wysyłamy id
    let savedPlaylists = require("./cache_dir/playlist_cache_manager").read()
    for(let playlist in savedPlaylists) {
        if(savedPlaylists[playlist].custom_rawVideoIds == req.headers.videos) {
            res.send(playlist)
            c = false;
        }
    }

    if(!c) return;

    // metadane
    let videos = req.headers.videos.split(";")
    if(videos[videos.length - 1].length == 0) {
        videos.pop();
    }
    let playlist_name = req.headers.playlist_name;
    let playlistId = "yt9-"
    let randomId = ""
    while(randomId.length !== 8) {
        randomId += "qwertyuiopasdfghjklzxcvbnm".split("")
                    [Math.floor(Math.random() * 26)]
    }
    playlistId += randomId
    let dateAdded = new Date().toString().split(" ")
    dateAdded.shift();
    dateAdded = dateAdded.slice(0, 3)
    dateAdded[1] += ","
    dateAdded = dateAdded.join(" ")

    // tworzenie elementu
    let playlistObject = {
        "name": playlist_name.split("&lt;").join("<").split("&gt;").join(">"),
        "videos": [],
        "creatorName": "",
        "creatorUrl": "",
        "description": "",
        "lastUpdate": dateAdded,
        "playlistId": playlistId,
        "videoCount": "",
        "custom_rawVideoIds": req.headers.videos
    }

    // dodawanie filmów do playlisty
    videos.forEach(video => {
        yt2009.fetch_video_data(video, (data => {
            playlistObject.videos.push({
                "id": video,
                "title": data.title,
                "thumbnail": "http://i.ytimg.com/vi/" + video + "/hqdefault.jpg",
                "uploaderName": data.author_name,
                "uploaderUrl": data.author_url
            })

            playlistObject.videoCount = playlistObject.videos.length;
            if(videos.length == playlistObject.videos.length) {
                // wszystkie filmy wrzucone, wysyłamy response
                sendResponse();
            }
        }), "", yt2009_utils.get_used_token(req), false)
    })

    function sendResponse() {
        playlistObject.videoCount += " videos"
        require("./cache_dir/playlist_cache_manager")
        .write(playlistId, playlistObject)
        res.send(playlistId)
    }
})

/*
======
relay
======
*/
app.get("/relay", (req, res) => {
    res.redirect("/relay/intro.htm")
})

/*
======
recommended section
======
*/
app.get("/yt2009_recommended", (req, res) => {
    let baseVids = req.headers.ids.split(",").slice(0, 3)
    let processedVideos = 0;
    let videoSuggestions = []
    yt2009.bulk_get_videos(baseVids, () => {
        baseVids.forEach(vid => {
            setTimeout(function() {
                // have video data, get related with exp_related
                let videoData = yt2009.get_cache_video(vid)
                let lookup_keyword = ""
                if(!videoData.tags || !videoData.title) {
                    processedVideos++;
                    if(processedVideos == baseVids.length) {
                        createSuggestionsResponse();
                    }
                    return;
                }

                // tags
                videoData.tags.forEach(tag => {
                    if(lookup_keyword.length < 9) {
                        lookup_keyword += `${tag.toLowerCase()} `
                    }
                })
                // first word from the title as backup
                if(lookup_keyword.length < 9) {
                    lookup_keyword = videoData.title.split(" ")[0]
                }

                // get!!
                yt2009_search.related_from_keywords(
                    lookup_keyword,
                    vid,
                    "",
                    (html, rawData) => {
                        rawData.forEach(video => {
                            videoSuggestions.push(video)
                        })
                        processedVideos++;
                        if(processedVideos == baseVids.length) {
                            createSuggestionsResponse();
                            return;
                        }
                    },
                    req.protocol
                )
            }, Math.floor(Math.random() * 1000) + 300)
        })  
    })

    function createSuggestionsResponse() {
        // get 8 random videos from videoSuggestions
        let filteredSuggestions = []
        while(filteredSuggestions.length !== 8) {
            let randomVideo = videoSuggestions[
                Math.floor(Math.random() * videoSuggestions.length)
            ]
            if(!randomVideo) {
                res.send("YT2009_NO_DATA")
                return;
            }
            // regenerate if needed to avoid duplicates
            while(JSON.stringify(filteredSuggestions)
                      .includes(randomVideo.id)) {
                randomVideo = videoSuggestions[
                    Math.floor(Math.random() * videoSuggestions.length)
                ]
            }

            filteredSuggestions.push(randomVideo)
        }


        // create and send html of filteredSuggestions
        let response = ""
        filteredSuggestions.forEach(video => {
            response += yt2009_templates.recommended_videoCell(video)
        })
        res.send(response)
    }
})
/*
pizdec
*/