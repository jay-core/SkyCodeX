// A vertical divider between two panes: drag it with a mouse, a finger or a pen.
// The drag is followed on the whole window, so it keeps going when the pointer runs ahead of the divider.
export default function Split(props: { onDrag: (dx: number) => void; onEnd?: () => void }) {
  let el!: HTMLDivElement;
  const down = (e: PointerEvent) => {
    e.preventDefault();
    let last = e.clientX;
    el.classList.add('drag');
    try { el.setPointerCapture(e.pointerId); } catch { /* the window listeners below still follow it */ }
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
