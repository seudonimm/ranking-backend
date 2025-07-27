const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const binaryParser = require('binary-parser');

dotenv.config();

const app = express();

app.use('/upload', express.raw({type: 'application/octet-stream', limit: '10mb'}));

app.get('/', (req, res) => {
    res.send('This better be working');
});

const PORT = 5000;

app.listen(PORT, () => {
    console.log(`Server running on https://localhost:${PORT}`);
});


app.post('/upload', (req, res) => {
    // res.status(201).json(req.body);
    const buffer = req.body;
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    
    const metadata = parseReplay(arrayBuffer);
    
    console.log('working', metadata);
    res.status(201).send('upload'+ req.body);
});

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

    const replay = {
        date1: new Date(readUtf8String(0x38, 0x18)),
        winner: view.getUint8(0x98),
        p1_name: readUtf16String(0xa4, 0x24),
        p2_name: readUtf16String(0x16E, 0x24),
        p1_toon: view.getUint32(0x230, true),
        p2_toon: view.getUint32(0x234, true),
        recorder: readUtf16String(0x240, 0x24),
        p1_steamid64: readUint64LE(0x9C).toString(),
        p2_steamid64: readUint64LE(0x166).toString(),
        recorder_steamid64: readUint64LE(0x238).toString()
    };

    return replay;
}