// Signature capture: draw with a finger, a stylus or a mouse, and the strokes
// come back as a PNG data URL.
//
// Pointer events cover all three input kinds with one set of handlers, and the
// canvas is sized to its own box at the device's pixel ratio so a signature
// taken on a phone is not a blurry enlargement of a small bitmap.

import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";

export default function SignaturePad({ value, onChange, disabled = false, height = 140 }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(Boolean(value));

  /** Sizes the backing store to the element, keeping whatever is already drawn. */
  const fit = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const snapshot = hasInk ? canvas.toDataURL() : null;
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(height * ratio);
    const ctx = canvas.getContext("2d");
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1f2421";
    if (snapshot) {
      const image = new Image();
      image.onload = () => ctx.drawImage(image, 0, 0, rect.width, height);
      image.src = snapshot;
    }
  }, [height, hasInk]);

  useEffect(() => {
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
    // Re-fitting on every ink change would redraw mid-stroke; size is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A signature that arrives from the server (a saved report reopened) is
  // painted in once, so the pad shows what was signed rather than a blank box.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !value || hasInk) return;
    const ctx = canvas.getContext("2d");
    const image = new Image();
    image.onload = () => {
      ctx.drawImage(image, 0, 0, canvas.getBoundingClientRect().width, height);
      setHasInk(true);
    };
    image.src = value;
  }, [value, hasInk, height]);

  const pointFrom = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const start = (event) => {
    if (disabled) return;
    drawing.current = true;
    canvasRef.current.setPointerCapture?.(event.pointerId);
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = pointFrom(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (event) => {
    if (!drawing.current || disabled) return;
    event.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = pointFrom(event);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasInk) setHasInk(true);
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange?.(canvasRef.current.toDataURL("image/png"));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    onChange?.("");
  };

  return (
    <div className="signature-pad">
      <canvas
        ref={canvasRef}
        style={{ height }}
        className={disabled ? "is-disabled" : ""}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        onPointerCancel={end}
      />
      <div className="signature-pad-foot">
        <span className="row-meta">{hasInk ? "Signed" : "Sign in the box above"}</span>
        {disabled ? null : (
          <button type="button" className="btn btn-ghost btn-sm" onClick={clear} disabled={!hasInk}>
            <Eraser size={13} /> Clear
          </button>
        )}
      </div>
    </div>
  );
}
