export function createPuzzleFetcher({ getToken }) {
  let lastPuzzleFetchAt = 0;
  let puzzleRateLimitUntil = 0;
  let lastPuzzleId = null;
  const recentPuzzleIds = [];

  async function fetchRandomPuzzle() {
    const now = Date.now();
    const minGapMs = 1200;
    if (now - lastPuzzleFetchAt < minGapMs) {
      await new Promise((resolve) => setTimeout(resolve, minGapMs - (now - lastPuzzleFetchAt)));
    }
    if (Date.now() < puzzleRateLimitUntil) {
      const waitMs = puzzleRateLimitUntil - Date.now();
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    const headers = {};
    const token = getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const requestWithBackoff = async (url, options = {}, includeHeaders = false) => {
      let delay = 600;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const response = await fetch(url, {
          ...options,
          headers: includeHeaders ? headers : undefined,
          cache: "no-store"
        });
        if (response.ok) {
          lastPuzzleFetchAt = Date.now();
          return response.json();
        }
        if (response.status !== 429) {
          throw new Error(`Puzzle request failed: ${response.status}`);
        }
        const retryAfter = response.headers.get("Retry-After");
        if (retryAfter) {
          const retrySeconds = Number.parseInt(retryAfter, 10);
          if (!Number.isNaN(retrySeconds)) {
            puzzleRateLimitUntil = Math.max(puzzleRateLimitUntil, Date.now() + retrySeconds * 1000);
          }
        } else {
          puzzleRateLimitUntil = Math.max(puzzleRateLimitUntil, Date.now() + 4000);
        }
        if (attempt === 2) {
          throw new Error(`Puzzle request failed: ${response.status}`);
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      }
      throw new Error("Puzzle request failed: 429");
    };
    const requestPuzzle = (url, options = {}) => requestWithBackoff(url, options, true);
    const requestPuzzleNoAuth = (url, options = {}) => requestWithBackoff(url, options, false);
    let endpoint = "https://lichess.org/api/puzzle/daily";
    if (token) {
      endpoint = "https://lichess.org/api/puzzle/next";
    }
    let data = null;
    const recentSet = new Set(recentPuzzleIds);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      data = await requestPuzzle(`${endpoint}?t=${Date.now()}`);
      const puzzleId = data?.puzzle?.id || null;
      if (!puzzleId || !recentSet.has(puzzleId)) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    if (token && data?.puzzle?.id && data.puzzle.id === lastPuzzleId) {
      try {
        const nextData = await requestPuzzle("https://lichess.org/api/puzzle/next", {
          method: "POST"
        });
        if (nextData?.puzzle?.id && nextData.puzzle.id !== lastPuzzleId) {
          data = nextData;
        }
      } catch (error) {
        console.warn("Puzzle skip failed", error);
      }
    }

    if (!token && data?.puzzle?.id && data.puzzle.id === lastPuzzleId) {
      try {
        const nextData = await requestPuzzleNoAuth(
          `https://lichess.org/api/puzzle/next?t=${Date.now()}`
        );
        if (nextData?.puzzle?.id && nextData.puzzle.id !== lastPuzzleId) {
          data = nextData;
          endpoint = "https://lichess.org/api/puzzle/next";
        }
      } catch (error) {
        try {
          const nextData = await requestPuzzleNoAuth("https://lichess.org/api/puzzle/next", {
            method: "POST"
          });
          if (nextData?.puzzle?.id && nextData.puzzle.id !== lastPuzzleId) {
            data = nextData;
            endpoint = "https://lichess.org/api/puzzle/next";
          }
        } catch (innerError) {
          console.warn("Anonymous puzzle skip failed", innerError);
        }
      }
    }

    const puzzleId = data?.puzzle?.id || null;
    const repeated = Boolean(lastPuzzleId && puzzleId && puzzleId === lastPuzzleId);
    if (puzzleId) {
      recentPuzzleIds.push(puzzleId);
      while (recentPuzzleIds.length > 5) {
        recentPuzzleIds.shift();
      }
    }
    lastPuzzleId = puzzleId || lastPuzzleId;
    console.log("Puzzle fetch", {
      endpoint,
      authed: Boolean(token),
      puzzleId,
      repeated
    });
    return {
      data,
      repeated,
      requiresAuth: !token
    };
  }

  return { fetchRandomPuzzle };
}
