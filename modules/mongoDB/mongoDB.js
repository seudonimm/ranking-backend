const {MongoClient, ServerApiVersion} = require('mongodb');

const {decayDeviation, calcNewRating, calcNewDeviation} = require('../ranking/ranking');

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

const addPlayerToDB = async(steamID, didPlayerWin, character, playerName, metadata) => {
    try {
        await initMongo();
        
        const charArr = Array.from({length:36}, () => 0);
        charArr[character] = 1;
        const namesArr = [playerName]
        await client.db("Ranking_DB").collection("Player_Rankings").insertOne(
            {
                steamID: steamID,
                name: playerName,
                wins:0,
                losses:0,
                matches:[],
                ranking:{
                    rankScore: 1500,
                    deviation: 350
                },
                character_id:character
            }        
        )
        const playerExist = await getPlayerFromDB(steamID);
        if(!playerExist){
            await client.db("Ranking_DB").collection("Players").insertOne(
                {
                        steamID: steamID,
                        names:namesArr,
                        characters:charArr,
                        matches:[]
                } 
            )
        }
        console.log('entry added');
    } catch (e) {
        console.log(e);
    }
};

const updatePlayerToDB = async(steamID, didPlayerWin, character, playerName, metadata, opponentID) => {
    try {
        const ownRanking = await getPlayerRankingsFromDB(steamID);
        const otherRanking = await getPlayerRankingsFromDB(opponentID);
        
        console.log(isNaN(ownRanking.ranking.rankScore));
        console.log(isNaN(ownRanking.ranking.deviation));
        console.log(isNaN(otherRanking.ranking.rankScore));
        console.log(isNaN(otherRanking.ranking.deviation));

        let rating = Number(ownRanking.ranking.rankScore)
        let deviation = Number(ownRanking.ranking.deviation)

        let otherRating = (otherRanking.ranking.rankScore != undefined?Number(otherRanking.ranking.rankScore):1500)
        let otherDeviation = (otherRanking.ranking.deviation != undefined?Number(otherRanking.ranking.deviation):350)
        

        console.log(isNaN(rating));
        console.log(isNaN(deviation));
        console.log(isNaN(otherRating));
        console.log(isNaN(otherDeviation));

        let decayedDeviation = deviation;
        if(ownRanking.matches.length > 0){
            decayedDeviation = decayDeviation(
                deviation,
                new Date() - new Date(ownRanking.matches[ownRanking.matches.length - 1].datetime_)
            );
        }
        let otherDecayedDeviation = otherDeviation;
        if(otherRanking.matches.length > 0){
            otherDecayedDeviation = decayDeviation(
                otherDeviation,
                new Date() - new Date(otherRanking.matches[otherRanking.matches.length - 1].datetime_)
            );
        }
        const newRating = calcNewRating(
            rating,
            deviation,
            otherRating,
            otherDeviation,
            (didPlayerWin)?1:0
        );
        console.log(newRating)
        const newDeviation = calcNewDeviation(
            rating,
            deviation,
            otherRating,
            otherDeviation
        );
        console.log(newDeviation)
        await initMongo();
        await client.db("Ranking_DB").collection("Player_Rankings").updateOne(
            {
                steamID:steamID
            },
            {
                $inc: {
                    wins:didPlayerWin?1:0,
                    losses:didPlayerWin?0:1
                },
                $push: {
                    matches: {...metadata, rankScore:newRating},
                },
                $set:{
                    ranking: {
                        rankScore: newRating,
                        deviation: newDeviation
                    },
                    name:playerName
                }
            },
        )
        await client.db("Ranking_DB").collection("Players").updateOne(
            {
                steamID:steamID
            },
            {
                $inc: {
                    [`characters.${character}`]: 1,
                },
                $push: {
                    matches: {...metadata, rankScore:newRating},
                }
            },
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
            steamID:steamID
        });
        console.log(res);

        return res;
    } catch (e) {
        console.log(e);
    }

};
const getPlayerRankingsFromDB = async(steamID) => {
    try {
        await initMongo();
        const res = await client.db("Ranking_DB").collection("Player_Rankings").findOne({
            steamID:steamID
        });

        console.log(res);

        return res
    } catch (e) {
        console.log(e);
    }

};

const getAllPlayerRankingsFromDB = async(steamID) => {
    try {
        await initMongo();
        const res =  await client.db("Ranking_DB").collection("Player_Rankings").find({}).sort({[`ranking.rankScore`]: -1}).toArray()
        console.log(res);

        return res
    } catch (e) {
        console.log(e);
    }

};
const getAllPlayersFromDB = async(steamID) => {
    try {
        await initMongo();
        const res =  await client.db("Ranking_DB").collection("Players").find({}).toArray()
        console.log(res);

        return res
    } catch (e) {
        console.log(e);
    }

};



module.exports = {
    run,
    addPlayerToDB,
    updatePlayerToDB,
    getPlayerFromDB,
    getPlayerRankingsFromDB,
    getAllPlayerRankingsFromDB,
    getAllPlayersFromDB
}