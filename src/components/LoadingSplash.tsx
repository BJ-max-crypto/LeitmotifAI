export function LoadingSplash() {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-white"
      role="status"
      aria-label="Loading"
    >
      <video
        src="/loading.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className="h-[min(320px,55vh)] w-auto max-w-[90vw] object-contain"
      />
    </div>
  );
}
