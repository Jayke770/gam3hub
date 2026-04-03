import { pgTable, text, boolean, integer, timestamp, numeric, bigint } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const games = pgTable('games', {
  id: text('id').primaryKey(), // bytes32 gameId as hex
  isActive: boolean('is_active').notNull().default(true),
  totalPlayers: integer('total_players').notNull().default(0),
  headsPool: numeric('heads_pool').notNull().default('0'), // uint256
  tailsPool: numeric('tails_pool').notNull().default('0'), // uint256
  poolForWinners: numeric('pool_for_winners').notNull().default('0'), // uint256
  gameCreated: numeric('game_created').notNull(), // unix timestamp as string
  gameEnd: numeric('game_end').notNull().default('0'), // unix timestamp as string
  gameOutcome: integer('game_outcome'), // 0: tails, 1: heads
  serverSeed: text('server_seed'), // bytes32 hex
  commitment: text('commitment'), // bytes32 hex
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const bets = pgTable('bets', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  gameId: text('game_id').notNull().references(() => games.id),
  playerAddress: text('player_address').notNull(),
  side: integer('side').notNull(), // 0: tails, 1: heads
  amount: numeric('amount').notNull(), // uint256
  hasClaimed: boolean('has_claimed').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const gamesRelations = relations(games, ({ many }) => ({
  bets: many(bets),
}));

export const betsRelations = relations(bets, ({ one }) => ({
  game: one(games, {
    fields: [bets.gameId],
    references: [games.id],
  }),
}));
