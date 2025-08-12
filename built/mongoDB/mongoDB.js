var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import dotenv from "dotenv";
import { decayDeviation, calcNewRating, calcNewDeviation } from '../ranking/ranking';
import { MongoClient, ServerApiVersion } from 'mongodb';
dotenv.config();
const dbUri = `mongodb+srv://jwdusmn:${process.env.MONGO_DB_PASS}@cluster0.fhibu9k.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(dbUri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true
    }
});
const run = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield client.connect();
        yield client.db("Ranking_DB").command({ ping: 1 });
        console.log("Connected to DB");
    }
    finally {
        yield client.close();
    }
});
run().catch(console.dir);
const initMongo = () => __awaiter(void 0, void 0, void 0, function* () {
    if (!client.topology || !client.topology.isConnected()) {
        yield client.connect();
    }
});
const addPlayerToDB = (steamID, didPlayerWin, character, playerName, metadata) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield initMongo();
        const charArr = Array.from({ length: 36 }, () => 0);
        charArr[character] = 1;
        const namesArr = [playerName];
        yield client.db("Ranking_DB").collection("Player_Rankings").insertOne({
            steamID: steamID,
            name: playerName,
            wins: 0,
            losses: 0,
            matches: [],
            ranking: {
                rankScore: 1500,
                deviation: 350
            },
            character_id: character
        });
        const playerExist = yield getPlayerFromDB(steamID);
        if (!playerExist) {
            yield client.db("Ranking_DB").collection("Players").insertOne({
                steamID: steamID,
                names: namesArr,
                characters: charArr,
                matches: []
            });
        }
        console.log('entry added');
    }
    catch (e) {
        console.log(e);
    }
});
const updatePlayerToDB = (steamID, didPlayerWin, character, playerName, metadata, opponentID) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const ownRanking = yield getPlayerRankingsFromDB(steamID);
        const otherRanking = yield getPlayerRankingsFromDB(opponentID);
        console.log(isNaN(ownRanking.ranking.rankScore));
        console.log(isNaN(ownRanking.ranking.deviation));
        console.log(isNaN(otherRanking.ranking.rankScore));
        console.log(isNaN(otherRanking.ranking.deviation));
        let rating = Number(ownRanking.ranking.rankScore);
        let deviation = Number(ownRanking.ranking.deviation);
        let otherRating = (otherRanking.ranking.rankScore != undefined ? Number(otherRanking.ranking.rankScore) : 1500);
        let otherDeviation = (otherRanking.ranking.deviation != undefined ? Number(otherRanking.ranking.deviation) : 350);
        console.log(isNaN(rating));
        console.log(isNaN(deviation));
        console.log(isNaN(otherRating));
        console.log(isNaN(otherDeviation));
        let decayedDeviation = deviation;
        if (ownRanking.matches.length > 0) {
            decayedDeviation = decayDeviation(deviation, Number(new Date()) - Number(new Date(ownRanking.matches[ownRanking.matches.length - 1].datetime_)));
        }
        let otherDecayedDeviation = otherDeviation;
        if (otherRanking.matches.length > 0) {
            otherDecayedDeviation = decayDeviation(otherDeviation, Number(new Date()) - Number(new Date(otherRanking.matches[otherRanking.matches.length - 1].datetime_)));
        }
        const newRating = calcNewRating(rating, deviation, otherRating, otherDeviation, (didPlayerWin) ? 1 : 0);
        console.log(newRating);
        const newDeviation = calcNewDeviation(rating, deviation, otherRating, otherDeviation);
        console.log(newDeviation);
        yield initMongo();
        yield client.db("Ranking_DB").collection("Player_Rankings").updateOne({
            steamID: steamID
        }, {
            $inc: {
                wins: didPlayerWin ? 1 : 0,
                losses: didPlayerWin ? 0 : 1
            },
            $push: {
                matches: Object.assign(Object.assign({}, metadata), { rankScore: newRating }),
            },
            $set: {
                ranking: {
                    rankScore: newRating,
                    deviation: newDeviation
                },
                name: playerName
            }
        });
        yield client.db("Ranking_DB").collection("Players").updateOne({
            steamID: steamID
        }, {
            $inc: {
                [`characters.${character}`]: 1,
            },
            $push: {
                matches: Object.assign(Object.assign({}, metadata), { rankScore: newRating }),
            }
        });
        console.log("entry updated");
    }
    catch (e) {
        console.log(e);
    }
});
const getPlayerFromDB = (steamID) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield initMongo();
        const res = yield client.db("Ranking_DB").collection("Players").findOne({
            steamID: steamID
        });
        console.log(res);
        return res;
    }
    catch (e) {
        console.log(e);
    }
});
const getPlayerRankingsFromDB = (steamID) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield initMongo();
        const res = yield client.db("Ranking_DB").collection("Player_Rankings").findOne({
            steamID: steamID
        });
        console.log(res);
        return res;
    }
    catch (e) {
        console.log(e);
    }
});
const getAllPlayerRankingsFromDB = (steamID) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield initMongo();
        const res = yield client.db("Ranking_DB").collection("Player_Rankings").find({}).sort({ [`ranking.rankScore`]: -1 }).toArray();
        console.log(res);
        return res;
    }
    catch (e) {
        console.log(e);
    }
});
const getAllPlayersFromDB = (steamID) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield initMongo();
        const res = yield client.db("Ranking_DB").collection("Players").find({}).toArray();
        console.log(res);
        return res;
    }
    catch (e) {
        console.log(e);
    }
});
module.exports = {
    run,
    addPlayerToDB,
    updatePlayerToDB,
    getPlayerFromDB,
    getPlayerRankingsFromDB,
    getAllPlayerRankingsFromDB,
    getAllPlayersFromDB
};
