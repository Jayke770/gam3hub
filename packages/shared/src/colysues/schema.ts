import { ArraySchema, MapSchema, Schema, SetSchema, type } from "@colyseus/schema";

export class Bet extends Schema {
    @type("string") address: string = ""
    @type("number") amount: number = 0
    @type("number") side: number = 0
    @type("string") dt: string = ""
}

export class ChatMessage extends Schema {
    @type("string") user: string = ""
    @type("string") message: string = ""
    @type("string") dateTime: string = ""
}

export class CoinFlipState extends Schema {
    @type("string") gameId?: string
    @type("number") playerCount: number = 0
    @type("number") totalBet: number = 0
    @type("boolean") isDemoMode: boolean = false
    @type({ map: Bet }) bets = new MapSchema<Bet>()
    @type([ChatMessage]) messages = new ArraySchema<ChatMessage>()
}

export class MinesPlayer extends Schema {
    @type("string") address?: string
    @type("string") txHash?: string
}

export class MinesState extends Schema {
    @type("string") gameId?: string
    @type({ set: MinesPlayer }) players = new SetSchema<MinesPlayer>()
    @type("number") betAmount?: number
    @type("string") currentTurn?: string
    @type("string") status: "waiting" | "playing" | "ended" = "waiting"
}