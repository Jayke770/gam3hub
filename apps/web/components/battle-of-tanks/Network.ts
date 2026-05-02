import { Client, Room } from "@colyseus/sdk";

// Enable Colyseus debug panel (State, Send, Drop) in development
if (process.env.NODE_ENV !== "production") {
  import("@colyseus/sdk/debug");
}

export class Network {
  client: Client;
  room!: Room;

  constructor(serverUrl: string) {
    this.client = new Client(serverUrl);
  }

  async connect(username?: string): Promise<Room> {
    this.room = await this.client.joinOrCreate("battleOfTanks", { name: username });
    return this.room;
  }

  sendMove(x: number, y: number) {
    this.room?.send("move", { x, y });
  }

  sendTarget(angle: number) {
    this.room?.send("target", angle);
  }

  sendShoot(shooting: boolean) {
    this.room?.send("shoot", shooting);
  }

  sendName(name: string) {
    this.room?.send("name", name);
  }
}
