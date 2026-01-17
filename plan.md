# 3D Chess + Lichess Integration Plan

1. Initialize the project scaffold
   - Create a basic Node/Three.js project (Vite or similar) with a simple app entrypoint.
   - Set up a minimal HTML page, JS/TS entry, and dev server config.

2. Build the 3D scene baseline
   - Add a Three.js scene, camera, lights, and renderer.
   - Implement resize handling and an animation loop.
   - Add basic orbit or trackball controls for navigation.

3. Model the chessboard
   - Generate an 8x8 grid with alternating colors/materials.
   - Add a board base and coordinate labels if needed.

4. Model the chess pieces
   - Decide on asset style (primitive geometry vs. imported models).
   - Create or load models for all pieces.
   - Place pieces in starting positions.

5. Implement board interaction
   - Add raycasting for mouse/touch selection.
   - Highlight hovered/selected squares and pieces.
   - Support basic move input (select piece, select target).

6. Add chess rules engine
   - Integrate a chess rules library (e.g., chess.js) or implement rules.
   - Validate moves and update piece positions.
   - Track turn, check/checkmate, captures, and promotions.

7. Define game state syncing layer
   - Create a game state model separate from rendering.
   - Map game state to 3D scene objects.
   - Implement state updates and animation of moves.

8. Create UI overlay
   - Add a HUD for turn, clock, move list, and connection status.
   - Provide buttons for new game, resign, and settings.

9. Set up Lichess OAuth flow
   - Register an OAuth app in Lichess.
   - Implement auth flow (PKCE) to obtain access tokens.
   - Store tokens securely (session/local storage as appropriate).

10. Connect to Lichess API
    - Call user endpoint to verify login and show username.
    - Implement matchmaking or challenge creation.
    - Subscribe to game event stream.

11. Sync gameplay with Lichess
    - Translate Lichess moves into game state updates.
    - Send player moves to Lichess via API.
    - Handle resign, draw offers, and game end events.

12. Add multiplayer UX polish
    - Animate remote moves and captures.
    - Show opponent name and status.
    - Display connection errors and retries.

13. Testing and stability
    - Add basic unit tests for rules integration.
    - Add manual test checklist for OAuth and multiplayer.
    - Validate cross-browser behavior.

14. Build and deployment
    - Configure production build.
    - Deploy to a static host (Netlify/Vercel/etc.).
    - Verify OAuth redirect URLs in production.
