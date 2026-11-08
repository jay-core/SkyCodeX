export default function Split(props: { onDrag: (dx: number) => void; onEnd?: () => void }) {
  let el!: HTMLDivElement;
  const down = (e: PointerEvent) => {
    e.preventDefault();
    let last = e.clientX;
    el.classList.add('drag');
    try { el.setPointerCapture(e.pointerId); } catch {  }
    const move = (m: PointerEvent) => { props.onDrag(m.clientX - last); last = m.clientX; };
    const up = () => {
      el.classList.remove('drag');
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      props.onEnd?.();
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  };
  return <div ref={el} class="split" style={{ 'touch-action': 'none' }} onPointerDown={down} role="separator" aria-orientation="vertical" />;
}
