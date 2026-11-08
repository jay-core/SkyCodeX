import { createSignal } from 'solid-js';
import { api } from './api';

const [battery, setBattery] = createSignal(false);
let pref = 'auto', reduce = false;
export const saver = () => pref === 'always' || (pref === 'auto' && battery());

function apply() { document.documentElement.classList.toggle('calm', reduce || saver()); document.documentElement.classList.toggle('saver', saver()); }
export function setPowerPrefs(p: string | undefined, reduceMotion: boolean) { pref = p || 'auto'; reduce = reduceMotion; apply(); }
export function watchPower() {
  (api as any).power?.battery().then((b: boolean) => { setBattery(b); apply(); });
  (api as any).power?.onChange((b: boolean) => { setBattery(b); apply(); });
}
export { battery };
