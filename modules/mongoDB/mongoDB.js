const {MongoClient, ServerApiVersion} = require('mongodb');

const dotenv = require("dotenv");
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

        await client.db("admin").command({ping: 1});

        console.log("Connected to DB")
    } finally {
        await client.close()
    }
}
run().catch(console.dir);

const addPlayerToDB = async(steamID, playerName1, playerName2, didPlayerWin, character) => {
    await client().db("Ranking_DB").collection("Players").insertOne({
        steamID: steamID,
        names:[playerName1],
        wins:(didPlayerWin?1:0),
        losses:(didPlayerWin?0:1),
        matches:[{
            playerName1:playerName1,
            playerName2:playerName2
        }],
        rankScore:1000,
        characters:{
            [character]:1
        }
    })
};

const updatePlayerToDB = async(steamID, playerName1, playerName2, didPlayerWin, character) => {
    await client().db("Ranking_DB").collection("Players").updateMany({
        steamID: steamID
    },{
        $inc:{
            [(didPlayerWin?wins:losses)]:1,
        },
        $push:{
            matches:{
                playerName1:playerName1,
                playerName2:playerName2
            },
            characters:{
                [character]:1
            }
        },
    })
};

const getPlayerFromDB = async(steamID) => {
    const res = await client().db("Ranking_DB").collection("Players").findOne({
        steamID:steamID
    });
    if(res == null){
        return false;
    }
    return true;
};

module.exports = {
    run,
    addPlayerToDB,
    updatePlayerToDB,
    getPlayerFromDB
}