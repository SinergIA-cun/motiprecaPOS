export function SplashScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-navy-900">
      <div className="flex flex-col items-center gap-6">
        <img src="/logo-motipreca.png" alt="Motipreca" className="h-9 w-auto brightness-0 invert" />
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-navy-300 border-t-transparent" />
      </div>
    </div>
  );
}
