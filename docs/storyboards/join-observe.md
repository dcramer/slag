# Join and watch

Every state a peer passes through arriving at a room, watching, taking a seat and being moved to watching, in order, desktop then phone. The rules are in [DESIGN.md](../DESIGN.md) → Online; how it works on the wire is in [NETCODE.md](../NETCODE.md) → Seats and observers.

Regenerate with `pnpm shot join --out docs/storyboards/join-observe` (`tools/shot/join.ts`). The room info on these frames is staged, so a full room and a lost race are one frame each; the real flow runs in `pnpm online-test -- --only seats`.

## Arriving

**1. Connecting.** The room code, a token per peer already there, and a way back.

![](join-observe/01-connecting-desktop.jpg) ![](join-observe/01-connecting-phone.jpg)

**2. In the lobby.** Arriving in the lobby seats you. Watchers are chips in the online panel; the host has a × on each.

![](join-observe/02-lobby-joined-desktop.jpg) ![](join-observe/02-lobby-joined-phone.jpg)

**3. Watching the lobby.** Your chip is outlined; Join sits at the end of the online panel, and the open bay takes you too.

![](join-observe/03-lobby-watching-desktop.jpg) ![](join-observe/03-lobby-watching-phone.jpg)

**4. Arriving mid-match.** Straight into watching the live race: Watching in the top corner, Join in the bottom one.

![](join-observe/04-arrive-watching-desktop.jpg) ![](join-observe/04-arrive-watching-phone.jpg)

**5. A full room.** Join reads Match Full and does nothing.

![](join-observe/05-match-full-desktop.jpg) ![](join-observe/05-match-full-phone.jpg)

**6. A seat frees.** Someone chose to watch from next round: Join lights up at once.

![](join-observe/06-seat-frees-desktop.jpg) ![](join-observe/06-seat-frees-phone.jpg)

## Joining

**7. The join card.** Over the live match: your toy, the dice, your name, the seats as they stand, Join.

![](join-observe/07-join-card-desktop.jpg) ![](join-observe/07-join-card-phone.jpg)

**8. A new look and a name.** The dice rolled again and the name edited, before going in.

![](join-observe/08-join-card-new-look-desktop.jpg) ![](join-observe/08-join-card-new-look-phone.jpg)

**9. Asking.** The host hasn't answered yet.

![](join-observe/09-joining-desktop.jpg) ![](join-observe/09-joining-phone.jpg)

**10. Won.** A seat for next round.

![](join-observe/10-in-next-round-desktop.jpg) ![](join-observe/10-in-next-round-phone.jpg)

**11. Taken.** Someone else asked first for the last seat; back to watching, with the match full.

![](join-observe/11-taken-desktop.jpg) ![](join-observe/11-taken-phone.jpg)

**12. Waiting for the round to end.** The corner says so; no Join while a seat is waiting.

![](join-observe/12-queued-desktop.jpg) ![](join-observe/12-queued-phone.jpg)

**13. Seated.** The next round's crate, with you in it.

![](join-observe/13-seated-desktop.jpg) ![](join-observe/13-seated-phone.jpg)

## Watching instead

**14. Watch from the lobby.** The eye beside the dice frees your seat at once.

![](join-observe/14-swap-lobby-desktop.jpg) ![](join-observe/14-swap-lobby-phone.jpg)

**15. Watch mid-match.** Chosen in Settings: you play the round out, and the corner says Watching Next Round.

![](join-observe/15-swap-mid-match-desktop.jpg) ![](join-observe/15-swap-mid-match-phone.jpg)

**16. AFK.** An idle player's card says AFK; moved to the watchers, their chip does too.

![](join-observe/16-afk-desktop.jpg) ![](join-observe/16-afk-phone.jpg)

## When the room fails

**17. Online Not Set Up.**

![](join-observe/17-failed-unset-desktop.jpg) ![](join-observe/17-failed-unset-phone.jpg)

**18. Room Is Full.** Twelve peers already: eight seats and four watchers.

![](join-observe/18-failed-full-desktop.jpg) ![](join-observe/18-failed-full-phone.jpg)

**19. Cannot Reach Host.**

![](join-observe/19-failed-unreachable-desktop.jpg) ![](join-observe/19-failed-unreachable-phone.jpg)

**20. Different Version.** The host runs another build.

![](join-observe/20-failed-version-desktop.jpg) ![](join-observe/20-failed-version-phone.jpg)

**21. Kicked.** A minute out, counting down; a reload or a new tab lands here too.

![](join-observe/21-failed-kicked-desktop.jpg) ![](join-observe/21-failed-kicked-phone.jpg)

**22. The ban is up.** Rejoin.

![](join-observe/22-kicked-rejoin-desktop.jpg) ![](join-observe/22-kicked-rejoin-phone.jpg)

## Gone

**23. A player gone, and one AFK.** Unplugged on the chip for the one whose tab closed (dropped after 40 s); AFK for the one who's there but idle.

![](join-observe/23-gone-player-desktop.jpg) ![](join-observe/23-gone-player-phone.jpg)
