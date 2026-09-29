import { nicknameIssue, type NicknameIssue } from "@labyrinth/protocol";

/** The last nickname used in this browser; only prefills the field. */
const KEY = "labyrinth.nickname";

export function loadNickname(storage: Storage | undefined = globalThis.localStorage): string {
  try {
    return storage?.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveNickname(nickname: string, storage: Storage | undefined = globalThis.localStorage): void {
  try {
    storage?.setItem(KEY, nickname);
  } catch {
    // Storage blocked (private mode): the field simply starts empty next time.
  }
}

export type NicknameCheck = { ok: true; nickname: string } | { ok: false; issue: NicknameIssue };

/** Validates what the player typed with the server's own rule; a valid name comes back trimmed. */
export function checkNickname(input: string): NicknameCheck {
  const nickname = input.trim();
  const issue = nicknameIssue(nickname);
  return issue ? { ok: false, issue } : { ok: true, nickname };
}

/** Words of the random default name: an adjective and an animal, in each UI language. */
const NAME_WORDS = {
  fi: {
    adjectives: ["Rohkea", "Nopea", "Viisas", "Iloinen", "Ovela", "Hurja", "Utelias", "Reipas", "Tyyni", "Sinnikäs", "Salainen", "Villi", "Kiltti", "Ketterä", "Uninen", "Urhea", "Hilpeä", "Leppoisa", "Mahtava", "Sisukas", "Lempeä", "Vikkelä", "Terävä", "Hauska", "Onnekas", "Pirteä", "Sähäkkä", "Taitava", "Valpas", "Uljas"],
    animals: ["Ilves", "Kettu", "Karhu", "Susi", "Pöllö", "Hirvi", "Majava", "Saukko", "Siili", "Orava", "Näätä", "Kurki", "Joutsen", "Haukka", "Korppi", "Tikka", "Jänis", "Peura", "Ahma", "Hylje", "Lohi", "Hauki", "Myyrä", "Kotka", "Varis", "Tiainen", "Sopuli", "Hiiri", "Poro", "Norppa"],
  },
  en: {
    adjectives: ["Brave", "Swift", "Wise", "Jolly", "Sly", "Wild", "Curious", "Bold", "Calm", "Clever", "Secret", "Lucky", "Gentle", "Nimble", "Sleepy", "Mighty", "Happy", "Quiet", "Sharp", "Merry", "Keen", "Plucky", "Daring", "Witty", "Cozy", "Sunny", "Frosty", "Dizzy", "Noble", "Rapid"],
    animals: ["Lynx", "Fox", "Bear", "Wolf", "Owl", "Moose", "Beaver", "Otter", "Hedgehog", "Squirrel", "Marten", "Crane", "Swan", "Hawk", "Raven", "Badger", "Hare", "Deer", "Seal", "Salmon", "Pike", "Frog", "Eagle", "Crow", "Lemming", "Mouse", "Reindeer", "Puffin", "Walrus", "Heron"],
  },
} as const;

export type NameLanguage = keyof typeof NAME_WORDS;
export const NAME_LANGUAGES = Object.keys(NAME_WORDS) as NameLanguage[];

/** The word lists of `language` ("en-GB" → en); Finnish for anything unknown. */
export function nameWords(language: string) {
  const base = language.slice(0, 2);
  return NAME_WORDS[(base in NAME_WORDS ? base : "fi") as NameLanguage];
}

/** A random default nickname such as "Rohkea Ilves", so a new player can start at once. */
export function randomNickname(language: string, random: () => number = Math.random): string {
  const { adjectives, animals } = nameWords(language);
  const pick = <T>(list: readonly T[]) => list[Math.floor(random() * list.length)]!;
  return `${pick(adjectives)} ${pick(animals)}`;
}
