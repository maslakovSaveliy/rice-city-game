"use client";

import { useEffect, useRef } from "react";
import styles from "./ParticleCanvas.module.scss";
import { attachSurface, detachSurface, resizeSurface } from "./particles";

/**
 * Холст для частиц. React отвечает только за монтирование и размер — вся
 * отрисовка идёт императивно из игрового цикла.
 */
export function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }

    attachSurface(canvas);

    const observer = new ResizeObserver(() => resizeSurface());
    observer.observe(canvas);
    window.addEventListener("orientationchange", resizeSurface);

    return () => {
      observer.disconnect();
      window.removeEventListener("orientationchange", resizeSurface);
      detachSurface();
    };
  }, []);

  // Обёртка нужна ради доступности: `<canvas>` считается интерактивным
  // элементом, и вешать на него `aria-hidden` нельзя. На обычном div — можно.
  return (
    <div aria-hidden="true" className={styles.root}>
      <canvas className={styles.canvas} ref={canvasRef} />
    </div>
  );
}
