/** « Rege » + « Plaza » en couleur d'accent. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`font-black tracking-tight ${className}`}>
      Rege<span className="text-accent">Plaza</span>
    </span>
  );
}
