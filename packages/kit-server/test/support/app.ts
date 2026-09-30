import { schema, t, type SchemaType } from "@colyseus/schema";
import { defineRoom, defineServer, LobbyRoom } from "colyseus";
import {
  connectFourMoveSchema,
  connectFourOptionsSchema,
  connectFourRules,
  type ConnectFourGame,
  type ConnectFourMove,
  type ConnectFourOptions,
} from "@game-kit/protocol/testing";
import { KitGameRoom, mountWatch, type GameServerDefinition } from "../../src/index.js";

/** The test game's synced data: the board, like a game's own child schema. */
export const ConnectFourChild = schema({
  /** 0 = empty, else the seat whose disc it is; row-major, 7×6. */
  cells: t.array("uint8"),
  moves: t.uint16().default(0),
});
export type ConnectFourChild = SchemaType<typeof ConnectFourChild>;

export const connectFourServer: GameServerDefinition<ConnectFourGame, ConnectFourMove, ConnectFourOptions, ConnectFourChild> = {
  rules: connectFourRules,
  moveSchema: connectFourMoveSchema,
  optionsSchema: connectFourOptionsSchema,
  defaultOptions: {},
  Child: ConnectFourChild,
  reset(_options, child) {
    child.cells.clear();
    child.cells.push(...Array.from({ length: 42 }, () => 0));
    child.moves = 0;
  },
  sync(game, child) {
    game.cells.forEach((seat, i) => {
      if (child.cells[i] !== seat) child.cells[i] = seat;
    });
    child.moves = game.moves;
  },
};

/** The kit's own test room: Connect Four on the kit game room. */
export class ConnectFourRoom extends KitGameRoom<ConnectFourGame, ConnectFourMove, ConnectFourOptions, ConnectFourChild> {
  constructor() {
    super(connectFourServer);
  }
}

/** A server like a game's: the lobby, the game room and the watch route. */
const server = defineServer({
  rooms: {
    lobby: defineRoom(LobbyRoom),
    game: defineRoom(ConnectFourRoom).filterBy(["pool"]).enableRealtimeListing(),
  },
  express: (app) => {
    mountWatch(app);
  },
});

export default server;
