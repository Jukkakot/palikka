import { humanId } from "human-id";
import { matchMaker } from "colyseus";

export const ROOM_ID_PATTERN = /^[a-z]+(-[a-z]+)+$/;
const MAX_LENGTH = 32;
const MAX_ATTEMPTS = 20;

function candidate(): string {
  return humanId({ separator: "-", capitalize: false });
}

/**
 * A readable room id like `brave-otters-sing`, unique among running rooms.
 * `isTaken` is injectable for tests.
 */
export async function uniqueRoomId(
  isTaken: (id: string) => Promise<boolean> = async (id) => (await matchMaker.query({ roomId: id })).length > 0,
  generate: () => string = candidate,
): Promise<string> {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const id = generate();
    if (id.length <= MAX_LENGTH && ROOM_ID_PATTERN.test(id) && !(await isTaken(id))) return id;
  }
  throw new Error(`No free readable room id after ${MAX_ATTEMPTS} attempts`);
}
