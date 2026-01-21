export function createClockTicker({ onClocksChange, getLiveGameId, getLiveClock, setLiveClock }) {
  let clockInterval = null;

  function formatClock(ms) {
    if (typeof ms !== "number") {
      return "--:--";
    }
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  function stop() {
    if (clockInterval) {
      clearInterval(clockInterval);
      clockInterval = null;
    }
  }

  function start() {
    stop();
    clockInterval = setInterval(() => {
      if (!getLiveGameId()) {
        return;
      }
      const clock = getLiveClock();
      if (!clock || clock.white == null || clock.black == null) {
        return;
      }
      const now = Date.now();
      const elapsed = now - clock.lastUpdate;
      if (elapsed <= 0) {
        return;
      }
      clock.lastUpdate = now;
      if (clock.turn === "w") {
        clock.white = Math.max(0, clock.white - elapsed);
      } else {
        clock.black = Math.max(0, clock.black - elapsed);
      }
      setLiveClock(clock);
      onClocksChange({
        white: formatClock(clock.white),
        black: formatClock(clock.black)
      });
    }, 250);
  }

  return { start, stop, formatClock };
}
