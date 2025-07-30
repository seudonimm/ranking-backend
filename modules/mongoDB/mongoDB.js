const {MongoClient, ServerApiVersion, ObjectId} = require('mongodb');

const dotenv = require("dotenv");
const e = require('express');
dotenv.config();

const dbUri = `mongodb+srv://jwdusmn:${process.env.MONGO_DB_PASS}@cluster0.fhibu9k.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`

const client = new MongoClient(dbUri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true
    }
});

const run = async() => {
    try {
        await client.connect();

        await client.db("Ranking_DB").command({ping: 1});

        console.log("Connected to DB")
    } finally {
        await client.close()
    }
}
run().catch(console.dir);

const initMongo = async () => {
    if (!client.topology || !client.topology.isConnected()) {
        await client.connect();
    }
};

const addPlayerToDB = async(steamID, didPlayerWin, character, recorderName, metadata) => {
    try {
        await initMongo();
        const charArr = Array.from({length:36}, () => 0);
        //charArr[character] = 1;
        await client.db("Ranking_DB").collection("Players").updateOne(
            {
                _id:new ObjectId("688a340a91770d5582d1f1a0")
            },
            {
                $push:{
                    players:{
                        steamID: steamID,
                        names:[recorderName],
                        wins:0,
                        losses:0,
                        matches:[],
                        rankScore:1000,
                        characters:charArr
                    }
                }
            }
        )
        console.log('entry added');
    } catch (e) {
        console.log(e);
    }
};

const updatePlayerToDB = async(steamID, didPlayerWin, character, recorderName, metadata) => {
    try {
        await initMongo();
        await client.db("Ranking_DB").collection("Players").updateOne(
            {
                _id: new ObjectId("688a340a91770d5582d1f1a0")
            },
            {
                $inc: {
                    [`players.$[elem].${didPlayerWin ? 'wins' : 'losses'}`]: 1,
                    [`players.$[elem].characters.${character}`]: 1
                },
                $push: {
                    'players.$[elem].matches': metadata,
                }
            },
            {
                arrayFilters: [
                    { 'elem.steamID': steamID }
                ]
            }
        )
        console.log("entry updated");
    } catch (e) {
        console.log(e);
    }
};

const getPlayerFromDB = async(steamID) => {
    try {
        await initMongo();
        const res = await client.db("Ranking_DB").collection("Players").findOne({
            _id:new ObjectId("688a340a91770d5582d1f1a0")
        });
                console.log(res);

        let exists = false;
        for(let e of res.players){
            if(e.steamID == steamID){
                exists = true;
            }
        }
        return exists;
    } catch (e) {
        console.log(e);
    }

};

module.exports = {
    run,
    addPlayerToDB,
    updatePlayerToDB,
    getPlayerFromDB
}