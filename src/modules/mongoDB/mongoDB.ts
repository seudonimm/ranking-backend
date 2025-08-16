import dotenv from "dotenv";
import {decayDeviation, calcNewRating, calcNewDeviation} from '../ranking/ranking.ts';

import {MongoClient, ServerApiVersion} from 'mongodb';
import type {WithId} from 'mongodb';
import type { MetadataType } from '../../types/Types.ts';

interface Ranking {
    matches:Match[]
    ranking:{
        rankScore:number,
        deviation:number
    }
}

interface Match{
    datetime_:string
}

dotenv.config();

const dbUri = `mongodb+srv://jwdusmn:${process.env.MONGO_DB_PASS}@cluster0.fhibu9k.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`

const client = new MongoClient(dbUri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true
    }
});

export const run = async() => {
    try {
        await client.connect();

        await client.db("Ranking_DB").command({ping: 1});

        console.log("Connected to DB")
    } finally {
        await client.close()
    }
}
run().catch(console.dir);

export const initMongo = async () => {
    try {
        await client.connect()
    } catch (e) {
        console.log(e);
    }
    // if (!client.topology || !client.topology.isConnected()) {
    //     await client.connect();
    // }
};

export const addPlayerToDB = async(steamID:string, didPlayerWin:boolean, character:number, playerName:string, metadata:MetadataType) => {
    try {
        await initMongo();
        
        const charArr = Array.from({length:36}, () => 0);
        charArr[character] = 1;
        const namesArr = [playerName]
        await client.db("Ranking_DB").collection("Player_Rankings").insertOne(
            {
                steamID: steamID,
                name: playerName,
                wins:didPlayerWin?1:0,
                losses:!didPlayerWin?1:0,
                matches:[{...metadata, rankScore:1500}],
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
                        matches:[{...metadata, rankScore:1500}]
                } 
            )
        }
        console.log('entry added');
    } catch (e) {
        console.log(e);
    }
};

export const updatePlayerToDB = async(steamID:string, didPlayerWin:boolean, character:number, playerName:string, metadata:MetadataType, opponentID:string) => {
    try {
        const ownRankExistCheck = await getPlayerRankingFromDB(steamID, character); 
        const otherRankExistCheck = await getPlayerRankingFromDB(opponentID, character); 
        
        if(!ownRankExistCheck){
            throw new Error("ownRankExistCheck is undefined")
        }
        if(!otherRankExistCheck){
            throw new Error("otherRankExistCheck is undefined")
        }
        const ownRanking:WithId<Ranking> = ownRankExistCheck;
        const otherRanking:WithId<Ranking> = otherRankExistCheck;
        
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

        //todo: fix decayDeviation calc
        let decayedDeviation = deviation;
        if(ownRanking.matches.length > 0){
            decayedDeviation = decayDeviation(
                deviation,
                Number(new Date()) - Number(new Date(ownRanking.matches[ownRanking.matches.length - 1].datetime_))
            );
        }
        let otherDecayedDeviation = otherDeviation;
        if(otherRanking.matches.length > 0){
            otherDecayedDeviation = decayDeviation(
                otherDeviation,
                Number(new Date()) - Number(new Date(otherRanking.matches[otherRanking.matches.length - 1].datetime_))
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
                    matches: {...(metadata as any), rankScore:newRating},
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
                    matches: {...(metadata as any), rankScore:newRating},
                }
            },
        )
        console.log("entry updated");
    } catch (e) {
        console.log(e);
    }
};

export const getPlayerFromDB = async(steamID:string) => {
    try {
        await initMongo();
        const res = await client.db("Ranking_DB").collection<Ranking>("Players").findOne({
            steamID:steamID
        });
        console.log(res);

        return res;
    } catch (e) {
        console.log(e);
    }

};

export const getPlayerRankingFromDB = async(steamID:string, character_id:number) => {
    try {
        await initMongo();
        const res = await client.db("Ranking_DB").collection<Ranking>("Player_Rankings").findOne({
            steamID:steamID,
            character_id:character_id
        });

        console.log(res);

        return res
    } catch (e) {
        console.log(e);
    }

};

export const getAllSpecificPlayerRankingsFromDB = async(steamID:string) => {
    try {
        await initMongo();
        const res = await client.db("Ranking_DB").collection("Player_Rankings").find({
            steamID: steamID
        }).toArray();

        console.log(res);

        return res;
    } catch (e) {
        console.log(e);
    }
};

export const getAllPlayerRankingsFromDB = async() => {
    try {
        await initMongo();
        const res =  await client.db("Ranking_DB").collection<Ranking>("Player_Rankings").find({}).sort({[`ranking.rankScore`]: -1}).toArray()
        console.log(res);

        return res
    } catch (e) {
        console.log(e);
    }

};
export const getAllPlayersFromDB = async() => {
    try {
        await initMongo();
        const res =  await client.db("Ranking_DB").collection("Players").find({}).toArray()
        console.log(res);

        return res
    } catch (e) {
        console.log(e);
    }

};

