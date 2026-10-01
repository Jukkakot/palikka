import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { GameScreen } from "./screens/GameScreen.tsx";
import { StartScreen } from "./screens/StartScreen.tsx";
import { WaitingRoomScreen } from "./screens/WaitingRoomScreen.tsx";
import { devBotCount, devWatchCount, dropDevShortcut } from "./session/devShortcut.ts";
import { dropInviteFromUrl, inviteFromUrl, loadNickname, loadToken, randomNickname, useOpenGames, useServerWake } from "@game-kit/client";
import { palikkaListing } from "./session/palikkaClient.ts";
import { quickPlayPool, useGameSession } from "./session/useGameSession.ts";

/** Read once at load: a stored reconnection token wins over an invite link (a reload rejoins the tab's game). */
function initialInvite(): string | undefined {
  const invite = loadToken() ? undefined : inviteFromUrl();
  if (!invite) dropInviteFromUrl();
  return invite;
}

const pool = quickPlayPool() ?? "";
/** Development shortcuts `?dev=1v3` (play) and `?dev=0v3` (watch); read once at load. */
const devBots = loadToken() ? undefined : devBotCount();
const devWatch = loadToken() ? undefined : devWatchCount();

export default function App() {
  // Started before anything else, so a sleeping server wakes while the player reads the start screen.
  const wake = useServerWake();
  const session = useGameSession();
  const [invite, setInvite] = useState(initialInvite);
  const inGame = session.status === "playing" && session.view !== undefined;
  const openGames = useOpenGames(palikkaListing, pool, !inGame && !invite && wake.state !== "waking");
  const { i18n } = useTranslation();
  const { playBots, watchBots, status } = session;
  const devUsed = useRef(false);

  useEffect(() => {
    // Bot games, played or watched, run on the device and start at once.
    if ((devBots ?? devWatch) === undefined || devUsed.current || status !== "idle") return;
    devUsed.current = true;
    dropDevShortcut();
    const nickname = loadNickname() || randomNickname(i18n.language);
    if (devBots !== undefined) playBots(nickname, devBots);
    else watchBots(nickname, devWatch!);
  }, [status, playBots, watchBots, i18n.language]);

  if (inGame && session.view!.phase === "waiting") return <WaitingRoomScreen view={session.view!} session={session} />;
  if (inGame) return <GameScreen view={session.view!} session={session} />;
  return (
    <StartScreen
      session={session}
      wake={wake}
      openGames={openGames}
      invite={invite}
      onInviteDone={() => {
        setInvite(undefined);
        dropInviteFromUrl();
      }}
    />
  );
}
