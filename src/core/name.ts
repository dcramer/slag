/**
 * Player names from anywhere untrusted: the wire, the lobby list, a saved profile. Pure, with no imports, so the
 * signaling API can run the same rules as the game.
 */

/** The longest a player's name may be, in UTF-16 units: name entry's limit, and what the wire and the API cap at. */
export const NAME_MAX = 12;

/**
 * A name made safe to show: whitespace collapsed to single spaces, no control or format characters (bidi overrides,
 * zero-width joiners), trimmed, at most NAME_MAX. '' when nothing is left, or for anything that isn't a string.
 */
export function tidyName(v: unknown): string {
  if (typeof v !== 'string') return '';
  return (
    v
      .slice(0, 256) // bounds the work on a hostile string; a name worth keeping is far shorter
      .replace(/\s/g, ' ')
      .replace(/\p{C}/gu, '')
      .replace(/ {2,}/g, ' ')
      .trim()
      .slice(0, NAME_MAX)
      // A cut through a surrogate pair leaves half a character.
      .replace(/\p{Cs}/gu, '')
      .trim()
  );
}
