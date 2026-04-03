import { Room, Client, CloseCode, Messages } from "colyseus";
import { CoinFlipState } from "@workspace/shared/colysues/schema"
import { z } from 'zod'
const ChatSchema = z.object({
  user: z.string().min(1),
  message: z.string().min(1),
  dateTime: z.date().default(() => new Date())
})
export class CoinFlip extends Room {
  state = new CoinFlipState();
  messages = {
    hi: (client: Client, message: any) => {
      console.log("hiiii", message);
      this.broadcast("hi", { message: "hello" })
    },
    chat: (_client: Client, message: z.infer<typeof ChatSchema>) => {
      const validatedMessage = ChatSchema.safeParse(message)
      if (validatedMessage.success) {
        this.broadcast("chat", validatedMessage.data)
      }
    }
  };

  onCreate(options: any) {

  }

  onJoin(client: Client, options: any) {
    this.state.players++;
    console.log(client.sessionId, "joined!", options);
  }

  async onLeave(client: Client, code: CloseCode) {
    this.state.players--;
    console.log(client.sessionId, "left!", code);
    if (code !== CloseCode.CONSENTED) {
      await this.allowReconnection(client, 1000000);
    }
  }

  onDispose() {
    console.log("room", this.roomId, "disposing...");
  }
}
