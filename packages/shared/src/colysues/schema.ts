import { Schema, type } from "@colyseus/schema";

export class Bet extends Schema {
    @type("string") address: string = ""
    @type("number") amount: number = 0
    @type("number") side: number = 0
    @type("string") dt: string = ""
}

export class CoinFlipState extends Schema {
    @type("string") gameId?: string
    @type("number") playerCount: number = 0
    @type("number") totalBet: number = 0
    @type("boolean") isDemoMode: boolean = false
    @type({ map: Bet }) bets: Map<string, Bet> = new Map()
}
