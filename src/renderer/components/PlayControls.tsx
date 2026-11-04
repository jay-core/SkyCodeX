// Play controls, the same in both flow views: restart (the start of the run, then play), play / pause (Space), one
// step (→), and the speed (+ / −).
// 0.25× first: a first reading can go slowly
const SPEEDS = [0.25, 0.5, 1, 1.5, 2, 3];

export default function PlayControls(props: { playing: boolean; speed: number; toggle: () => void; restart: () => void; step: () => void; setSpeed: (k: number) => void }) {
  const next = () => SPEEDS.find((s) => s > props.speed + 1e-6) ?? SPEEDS[0];
  const label = () => `${Math.round(props.speed * 100) / 100}×`;
  return (
    <span class="playc" role="group" aria-label="play the run">
      <button title="restart: back to the start of the run, then play" aria-label="restart" onClick={props.restart}>⟲</button>
      <button classList={{ on: props.playing }} aria-pressed={props.playing} title={props.playing ? 'pause (Space)' : 'play (Space)'} aria-label={props.playing ? 'pause' : 'play'} onClick={props.toggle}>{props.playing ? '⏸' : '▶'}</button>
      <button title="one step (→)" aria-label="one step" onClick={props.step}>⏭</button>
      <button class="spd" title="speed (+ / −); click for the next" aria-label={`speed ${label()}`} onClick={() => props.setSpeed(next())}>{label()}</button>
    </span>
  );
}
