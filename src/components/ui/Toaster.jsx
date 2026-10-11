import { useEffect, useState } from "react";
import "./Toaster.css";

const CONFETTI = ["#9a6a48", "#e8527f", "#4fae7d", "#d7b99a", "#ff9dbb", "#6b4129"];

export default function Toaster() {
  const [toasts, setToasts] = useState([]);
  const [confetti, setConfetti] = useState([]);

  useEffect(() => {
    const handler = (event) => {
      const id = Date.now() + Math.random();
      const { message, confetti: withConfetti } = event.detail;

      setToasts((current) => [...current, { id, message }]);
      setTimeout(
        () => setToasts((current) => current.filter((item) => item.id !== id)),
        4200
      );

      if (withConfetti) {
        const pieces = Array.from({ length: 26 }, (_, index) => ({
          id: `${id}-${index}`,
          color: CONFETTI[index % CONFETTI.length],
          left: Math.random() * 100,
          delay: Math.random() * 0.5,
          duration: 1.8 + Math.random() * 1.4,
          size: 6 + Math.random() * 8,
        }));

        setConfetti((current) => [...current, ...pieces]);
        setTimeout(
          () =>
            setConfetti((current) =>
              current.filter((piece) => !pieces.includes(piece))
            ),
          3600
        );
      }
    };

    window.addEventListener("narxtop:toast", handler);
    return () => window.removeEventListener("narxtop:toast", handler);
  }, []);

  return (
    <>
      <div className="toaster" role="status" aria-live="polite">
        {toasts.map((item) => (
          <div className="toast" key={item.id}>
            {item.message}
          </div>
        ))}
      </div>

      <div className="confetti-layer" aria-hidden="true">
        {confetti.map((piece) => (
          <span
            key={piece.id}
            className="confetti-piece"
            style={{
              left: `${piece.left}%`,
              width: `${piece.size}px`,
              height: `${piece.size * 1.6}px`,
              background: piece.color,
              animationDelay: `${piece.delay}s`,
              animationDuration: `${piece.duration}s`,
            }}
          />
        ))}
      </div>
    </>
  );
}
