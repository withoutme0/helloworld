import {MainItem, WorkerHandlers,Source} from "@watchedcom/sdk";
import * as cheerio from "cheerio";
import fetch from "node-fetch";
import urllib = require('urllib');


export const directoryHandler: WorkerHandlers["directory"] = async (input, {requestCache},page) => {
    console.log("directoryHandler", {input});
    const { id } = input;
    let items: MainItem[] = [];

    if (input.search) {
        const result = await fetch("https://diziay.me/filmler/tumu/tumu/tumu?q="  + input.search + "&pg=" + input.page, {});
        items = await getDirectoryItems(result, items);
        return {
            hasMore: items.length !== 0,
            items
        };
    }

    if(input.id === "orderpopular"){
        const result = await fetch("https://diziay.me/filmler/tumu/tumu/tumu?order=popular&pg="  + input.page, {});
        items = await getDirectoryItems(result,items);
    }
    else if(input.id === "orderimdb"){
        const result = await fetch("https://diziay.me/filmler/tumu/tumu/tumu?order=imdb&pg="  + input.page, {});
        items = await getDirectoryItems(result,items);
    }
    else if(input.id === "orderyear"){
        const result = await fetch("https://diziay.me/filmler/tumu/tumu/tumu?order=year&pg="  + input.page, {});
        items = await getDirectoryItems(result,items);
    }
    return {
        hasMore: items.length !== 0,
        items};
};

async function getDirectoryItems(result, items) {
    if (!result.ok) {
        throw new Error(`Request finished with status ${result.status}`);
    }
    const html = await result.text();
    let $ = cheerio.load(html);
    $("div.category__item").each(function (index, elem) {
        let context = $(elem).find("a").first();
        const name = context.find("span.movie-name").first().text();
        const posters = "https://diziay.me/" + context.find("img").attr("src");
        const id = $(elem).find("a").first().attr("href") + "";

        items.push({
            type: "movie",
            ids: {id},
            name: name,
            images: {
                poster: posters
            }
        });
    });
    return items;
}

// ITEMHANDLER-CODE

const getAccessToken = async () => {
    const response = await urllib.request('https://hdplayer.org/GetHash', {
        method: 'GET',
        headers: {
            'Referer': 'https://hdplayer.org',
            'Content-Type': 'application/json',
        }
    });

    const hash = JSON.parse(response.data.toString());
    return { 'view_h' : hash.hash, 'rnd': hash.time };
};

const getMediaResourceForMovie = (movieId, source, accessToken) => {
    return new Promise((resolve, reject) => {
        try {
            urllib.request(`https://hdplayer.org/player/alternative/movies/${movieId}/${source}`, {
                method: 'POST',
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "X-Requested-With": "XMLHttpRequest",
                },
                data: accessToken,
            }).then(async (response) => {
                const json = JSON.parse(response.data.toString());

                if(json.iframe) throw new Error('Err: json.iframe not implemented!');
                if(json.source && json.source.length) throw new Error('Err: json.source not implemented!');

                const re = /iframe src="https:\/\/feurl.com\/v\/(.*?)"/;
                const match = re.exec(json.iframe_html);
                const target = match ? `https://feurl.com/api/source/${match[1]}` : '';
                const sources = await getSourcesFromExternalPlayer(target, accessToken);
                resolve(sources);
            });
        } catch (err) {
            reject(err);
        }
    });
};

const getSourcesFromExternalPlayer = (url, accessToken) =>
    new Promise((resolve, reject) => {
        urllib.request(url, {
            method: 'POST',
            headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "X-Requested-With": "XMLHttpRequest",

            },
            data: accessToken
        }).then(response => {
            const json = JSON.parse(response.data.toString());

            const sources = json.data.map( item => ({
                type: 'url',
                name: item.label,
                format: item.type,
                url: item.file,
            }));

            resolve(sources);
        }).catch(err => reject(err));
    });

export const itemHandler: WorkerHandlers["item"] = async (
    input,
    { requestCache }
) => {
    console.log("itemHandler", { input });

    try{

        //meta data of item name, description year.... and sourceslinks
        const result = await fetch( input.ids.id + "", {});
        if (!result.ok) {
            throw new Error(`Request finished with status ${result.status}`);
        }
        const html = await result.text();
        let $ = cheerio.load(html);

        let name = $("div.info-title").children("h1").text();
        let description = $("div.movie-info-text").first().text().trimLeft().trimRight();
        let year = Number($("div.article-box").eq(1).find("span.list-content").text().trim().replace(/\s/g, ""));
        let cast:string[]  = [];
        $("span.cast-role").each( (index,elem) => {
            cast.push($(elem).find("span.name").first().text());
        });
        interface sourcelinksinterface {link: string;name: string}
        let sourcelinks: sourcelinksinterface []=[];
        $("div.movie-info-watch-buttons").children("div.lang-watch").each( (index,elem) => {
            sourcelinks.push({link: $(elem).find("a").first().attr("href") + "",
                name: $(elem).find("span.lang-text").first().text()});
        });
        let sources:Source[] = [];

        for (const elem of sourcelinks) {
            if(elem.link.includes("fragman"))
                continue;

            console.log(elem.link);
            const response = await fetch(elem.link);
            // Media sources
            const sourcenames = ['vidmoly', 'fembed', 'plus', 'stream', 'photos'];


            // Obtain the movie id
            const re = /src="https:\/\/hdplayer\.org\/player\/movies\/(.*?)"/;
            const match = re.exec(await response.text());

            const movieId = match ? match[1] : "";

            const token = await getAccessToken();
            const result = await getMediaResourceForMovie(movieId, 'fembed', token);

            for (const el of result) {

               sources.push({
                   id: elem.link + el.name,
                   type: "url",
                   name: elem.name + ": " + el.name,
                   url: el.url
               })
            }
        }
        console.log(sources);
        return {
            type: "movie",
            ids: input.ids,
            name: name,
            description: description,
            year: year,
            cast: cast,
            sources: sources
        };
    } catch (err) {
        console.error(err)
    }
};
