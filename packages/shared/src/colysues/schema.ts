import { Schema, type } from "@colyseus/schema";

export class CoinFlipState extends Schema {
    @type("number") players: number = 0
}
