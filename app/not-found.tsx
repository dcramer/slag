import { plainHTML } from '../src/ui/screens/markup';
import Game from './Game';

/** Served with a 404 status; the game's 404 screen is what shows. */
export default function NotFound() {
  return <Game html={plainHTML('missing')} />;
}
