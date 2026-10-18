import { useRef } from "react";

export function SignaturePad({ onChange }: { onChange: (d: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return [((e.clientX - r.left) * 500) / r.width, ((e.clientY - r.top) * 160) / r.height] as const;
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(ref.current!.toDataURL("image/png"));
  };
  return (
    <div>
      <canvas
        ref={ref} width={500} height={160}
        className="w-full touch-none rounded-md border-2 border-dashed border-border bg-card"
        onPointerDown={(e) => {
          drawing.current = true;
          const c = ref.current!.getContext("2d")!;
          c.lineWidth = 2; c.lineCap = "round";
          c.strokeStyle = getComputedStyle(document.body).color;
          const [x, y] = pos(e); c.beginPath(); c.moveTo(x, y);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const c = ref.current!.getContext("2d")!;
          const [x, y] = pos(e); c.lineTo(x, y); c.stroke();
        }}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <button type="button" className="mt-1 text-sm text-muted-foreground underline"
        onClick={() => { ref.current!.getContext("2d")!.clearRect(0, 0, 500, 160); onChange(""); }}>
        Clear signature
      </button>
    </div>
  );
}
