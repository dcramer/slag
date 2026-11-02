import GameHost from './GameHost';

/** The element the game takes over (src/main.ts). Every page renders exactly one. */
const ROOT_ID = 'slag';

/**
 * Every page's body: the game's root element, plus the client mount that hands it to the game.
 * `html` is the screen's own markup (src/ui/screens/markup.ts), server-rendered so it paints before
 * any script runs; the screen adopts it on mount. The game then moves between screens itself, without
 * Next routing, so this is rendered once per page load.
 */
export default function Game({ html }: { html?: string }) {
  return (
    <>
      <div id={ROOT_ID} dangerouslySetInnerHTML={html ? { __html: html } : undefined} />
      <GameHost rootId={ROOT_ID} />
    </>
  );
}
