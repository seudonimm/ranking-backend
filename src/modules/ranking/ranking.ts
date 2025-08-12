
//rating period length 
const RATING_PERIOD_LENGTH = 86400000 * 7; //a week in milliseconds

//initial deviation every player starts with
const INITIAL_DEVIATION = 350;
//used to determine how fast deviation decays
const C = 10;
//q is a constant that is used to transform rating scale
const Q = Math.LN10 / 400.0;

//calculates rank deviation/uncertatinty
export const decayDeviation = (currDeviation:number, timeSinceLastRating:number):number => {
    let decayCount:number = timeSinceLastRating/RATING_PERIOD_LENGTH;

    if(decayCount < 1 || isNaN(decayCount)){
        return currDeviation
    }else{
        let deviation:number = 0;
        
        for(let i = 0; i <= decayCount; i++){
            deviation = Math.sqrt(Math.pow(currDeviation, 2) + Math.pow(C, 2));
            deviation = Math.min(deviation, INITIAL_DEVIATION);
        }
        return deviation;

    }
}

//g represents how a rating's certainty affects outcome, the lower a deviation the higher g is
const calcG = (deviation:number):number => (
    1 / 
        Math.sqrt(1.0 + 
            (3.0 * Math.pow(Q, 2.0) * Math.pow(deviation, 2.0))
            / Math.pow(Math.PI, 2.0))
)

//e represents the expected value of a match
const calcE = (ownRating:number, ownDeviation:number, otherRating:number, otherDeviation:number):number => {
    let ratingDifference = ownRating - otherRating;
    console.log(ownDeviation + " " + otherDeviation);
    let g = calcG(Math.sqrt(Math.pow(ownDeviation, 2) + Math.pow(otherDeviation, 2)));
    
    console.log("g of e"+ isNaN(g))

    return 1.0 / (1.0 + Math.pow(10.0, g * ratingDifference / -400.0))
}

//d^2 is used to determine how quickly rating moves, 
const calcD2 = (ownRating:number, ownDeviation:number, otherRating:number, otherDeviation:number):number => {
    let g = calcG(otherDeviation);
    let e = calcE(ownRating, ownDeviation, otherRating, otherDeviation);

    return 1.0 / (Math.pow(Q, 2.0) * Math.pow(g, 2.0) * e * (1.0 - e))
}

//calculates new rating, outcome should be 1 for win, 0 for loss, 0.5 for a tie
export const calcNewRating = (ownRating:number, ownDeviation:number, otherRating:number, otherDeviation:number, outcome:number):number => {
    let g = calcG(otherDeviation);
    let e = calcE(ownRating, ownDeviation, otherRating, otherDeviation);
    let d2 = calcD2(ownRating, ownDeviation, otherRating, otherDeviation);

    console.log("G" + isNaN(g));
    console.log("e" + isNaN(e));
    console.log("d2" + isNaN(d2));

    return Math.max(1500, ownRating + (Q / ((1.0 / Math.pow(ownDeviation, 2.0)) + (1.0 / d2)) * g * (outcome - e)))

}

export const calcNewDeviation = (ownRating:number, ownDeviation:number, otherRating:number, otherDeviation:number):number => {
    let d2 = calcD2(ownRating, ownDeviation, otherRating, otherDeviation);

    return Math.sqrt(1.0 / ((1.0 / Math.pow(ownDeviation, 2.0)) + (1.0 / d2)))
}

// module.exports = {
//     decayDeviation,
//     calcNewRating,
//     calcNewDeviation
// }