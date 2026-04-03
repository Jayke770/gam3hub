"use client";

import { useState, useEffect, useRef } from "react";
import { Send, Loader2 } from "lucide-react";
import { truncate } from "@initia/utils";
import { useMessageStore } from "@/hooks/useMessageStore";
import { useRoom } from "@/components/providers/colyseus";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Field,
  FieldGroup,
} from "@workspace/ui/components/field";
import {
  InputGroup,
  InputGroupTextarea,
  InputGroupAddon,
} from "@workspace/ui/components/input-group";
import { Button } from "@workspace/ui/components/button";
import { InfiniteScroll } from "@workspace/ui/components/infinite-scroll";
import * as dateFns from 'date-fns'
const formSchema = z.object({
  message: z.string().min(1, "Message cannot be empty"),
});

type FormValues = z.infer<typeof formSchema>;

export function ChatArea() {
  const { room } = useRoom();
  const { hexAddress: userWalletAddress } = useInterwovenKit();
  const { messages: chat } = useMessageStore();
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const next = async () => {
    setIsLoading(true);

    /**
     * Simulate a network request
     */
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Here you would normally fetch more messages and prepend them 
    // to your store/state. For now we just simulate it's done.

    setHasMore(false);
    setIsLoading(false);
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      message: "",
    },
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  const onSubmit = (data: FormValues) => {
    console.log(data)
    room?.send("chat", {
      message: data.message,
      user: userWalletAddress || "0x0...",
    });
    form.reset();
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-2 custom-scrollbar flex flex-col">
        <div className="mt-auto space-y-1">
          <InfiniteScroll hasMore={hasMore} isLoading={isLoading} next={next}>
            {chat.map((msg) => (
              <div key={msg.id} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-primary">{truncate(msg.user)}</span>

                  <span className="text-[10px] text-muted-foreground font-medium">
                    {msg?.dateTime ? dateFns.format(msg?.dateTime, "h:mm a") : "Just now"}
                  </span>
                </div>
                <span className="text-sm bg-muted/40 p-3 rounded-2xl rounded-tl-sm text-foreground/90 w-fit max-w-[85%]">
                  {msg.message}
                </span>
              </div>
            ))}
          </InfiniteScroll>
          {isLoading && (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Chat Input */}
      <div className="p-4 border-t border-border/50 bg-card/80 backdrop-blur-md shrink-0">
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field data-invalid={!!form.formState.errors.message}>
              <InputGroup>
                <InputGroupTextarea
                  {...form.register("message")}
                  placeholder="Type a message..."
                  aria-label="Chat message"
                  aria-invalid={!!form.formState.errors.message}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      form.handleSubmit(onSubmit)();
                    }
                  }}
                />
                <InputGroupAddon align="inline-end">
                  <Button
                    type="submit"
                    variant="ghost"
                    className="text-primary hover:text-primary/80 cursor-pointer rounded-full"
                  >
                    <Send className="size-5" data-icon="inline-start" />
                  </Button>
                </InputGroupAddon>
              </InputGroup>
            </Field>
          </FieldGroup>
        </form>
      </div>
    </div>
  );
}
