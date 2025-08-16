import express from 'express';
import dotenv from 'dotenv';
import crypto from 'crypto';
import cors from 'cors';

import type { MetadataType } from './src/types/Types.ts';
const app = express();

import {
    run, 
    addPlayerToDB, 
    updatePlayerToDB, 
    getPlayerFromDB, 
    getPlayerRankingFromDB, 
    getAllPlayerRankingsFromDB, 
    getAllSpecificPlayerRankingsFromDB,
    getAllPlayersFromDB
} from './src/modules/mongoDB/mongoDB.ts';

dotenv.config();

const PORT = process.env.PORT || 5000;

const waitlist = {};

app.use('/upload', express.raw({type: 'application/octet-stream', limit: '10mb'}));

app.use(cors());

app.listen(PORT, () => {
    console.log(`Server running on port:${PORT}`);
});

app.get('/', async(req, res) => {
    try {
        const result = await getAllPlayerRankingsFromDB();

        res.status(200).send(result);
    } catch (e) {
        console.log(e)
        res.status(500).send(e);

    }
});

app.get('/player/:id', async(req, res) => {
    try {
        const playerRes = await getPlayerFromDB(req.params.id);
        const playerRankRes = await getAllSpecificPlayerRankingsFromDB(req.params.id)
        res.status(200).send({playerRes, playerRankRes});
    } catch (e) {
        console.log(e)
        res.status(500).send(e);
    }
});

app.post('/upload', async(req, res) => {
    try {
        const buffer = req.body;
        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        
        const metadata = parseReplay(arrayBuffer);
        
        console.log('working', metadata);


        if(!(metadata.filename in waitlist)){
            waitlist[metadata.filename] = metadata;
	        console.log('waitlist: ' + JSON.stringify(waitlist));
            res.status(201).send('added to waitlist '+ waitlist);
        }else{
            delete waitlist[metadata.filename];
            
            await checkAndAddToDB(metadata.p1_steamid64, (metadata.winner == 0), metadata.p1_toon, metadata.p1_name, metadata, metadata.p2_steamid64);
            await checkAndAddToDB(metadata.p2_steamid64, (metadata.winner == 1), metadata.p2_toon, metadata.p2_name, metadata, metadata.p1_steamid64);
            res.status(201).send('upload'+ req.body);
        }

        await postToReplayDB(buffer);
    } catch (e) {
        console.log(e);
        res.status(201).send('error: ' + e);
    }
});

// app.post('/uploadscrape', async(req, res) => {
//     try {
//         const dbRes = await fetch('https://bbreplay.ovh/api/replays');
//         const dbResJson = await dbRes.json();
//         //console.log(dbResJson);
//         // let count = 0;
//         // let interval = setInterval(() => {
//             const metadata = dbResJson.replays[0];
//             console.log('working test', metadata);
            
//             checkAndAddToDB(metadata.p1_steamid64, (metadata.winner == 0), metadata.p1_toon, metadata.p1, metadata, metadata.p2_steamid64);
//             checkAndAddToDB(metadata.p2_steamid64, (metadata.winner == 1), metadata.p2_toon, metadata.p2, metadata, metadata.p1_steamid64);
//         //     count++;
//         //     if(count >= dbResJson.replays.length){
//         //         clearInterval(interval);
//         //     }
//         // }, 500);
//         //await postToReplayDB(metadata);

//         res.status(201).send('scraped but not really'+ req.body);

//     } catch (e) {
//         res.status(201).send(e);

//     }
// });

const postToReplayDB = async(buffer) => {
    try {
        const post = await fetch('http://50.118.225.175:5000/upload',{
            method: 'POST',
            headers: {
                "Content-Type":"application/octet-stream"
            },
            body:buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
        });
        if(!post.ok){
            console.log("EEEEEE " + (await post.text()));
            throw new Error(`replay not sent replay db; HTTP error ${post.status}`);
        }else{
            console.log(`to DB ${await post.json()}`);
        }
    } catch (e) {
        console.log(e);
    }
};

const checkAndAddToDB = async(steamID:string, didPlayerWin:boolean, playerChar:number, playerName:string, metadata:MetadataType, opponentID:string) => {
    const player = await getPlayerFromDB(steamID);
    const playerRanking = await getPlayerRankingFromDB(steamID, playerChar);

    // const sameChar = ()
    if(player && playerRanking){
        await updatePlayerToDB(steamID, didPlayerWin, playerChar, playerName, metadata, opponentID);
    }else{
        await addPlayerToDB(steamID, didPlayerWin, playerChar, playerName, metadata);
    }

};

function parseReplay(arrayBuffer) {
    const view = new DataView(arrayBuffer);

    function readUtf16String(offset, byteLength) {
        const slice = new Uint8Array(arrayBuffer, offset, byteLength);
        let str = '';
        for (let i = 0; i < byteLength; i += 2) {
            const code = slice[i] + (slice[i + 1] << 8);
            if (code === 0) break;
            str += String.fromCharCode(code);
        }
        return str;
    }

    function readUtf8String(offset, byteLength) {
        const slice = new Uint8Array(arrayBuffer, offset, byteLength);
        return new TextDecoder('utf-8').decode(slice).replace(/\0/g, '');
    }

    function readUint64LE(offset) {
        const low = view.getUint32(offset, true);
        const high = view.getUint32(offset + 4, true);
        return BigInt(high) << 32n | BigInt(low);
    }

    function getHashedFilename() {
	const buffer = Buffer.from(arrayBuffer)
        const slice = (start, end) => buffer.slice(start, end);

        const p1Toon = slice(0x230, 4);
        const p2Toon = slice(0x234, 4);
        const p1SteamId = slice(0x9C, 8);
        const p2SteamId = slice(0x166, 8);
        const replayInputs = slice(0x8D0, 0x8D0 + 0xF730);

        const combined = Buffer.concat([p1Toon, p2Toon, p1SteamId, p2SteamId, replayInputs]);

        const hash = crypto.createHash('md5').update(combined).digest('hex').slice(0, 25);
        return hash + '.dat';
    }

    const replay:MetadataType = {
        date1: new Date(readUtf8String(0x38, 0x18)),
        winner: view.getUint8(0x98),
        p1_name: readUtf16String(0xa4, 0x24),
        p2_name: readUtf16String(0x16E, 0x24),
        p1_toon: view.getUint32(0x230, true),
        p2_toon: view.getUint32(0x234, true),
        recorder: readUtf16String(0x240, 0x24),
        p1_steamid64: readUint64LE(0x9C).toString(),
        p2_steamid64: readUint64LE(0x166).toString(),
        recorder_steamid64: readUint64LE(0x238).toString(),
        filename: getHashedFilename()
    };

    return replay;
}
