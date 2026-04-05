import { MinesState } from "@workspace/shared/colysues/schema";
import { Client, Messages, Room, RoomException, RoomMethodName } from "colyseus";

export class Mines extends Room {
    state = new MinesState();

    onCreate(options: any) {
        this.setMetadata({ players: options.players || [] });
    }

    onJoin(client: Client, options: { user: string }) {
        const user = options.user.toLowerCase();
        const players = this.metadata.players || [];
        if (!players.includes(user)) {
            players.push(user);
            this.setMetadata({ players });
        }
    }

    onLeave(client: Client) {
        // Optional: remove player from metadata if they disconnect permanently
    }
}