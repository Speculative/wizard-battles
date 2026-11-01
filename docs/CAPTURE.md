# Reproducible browser captures

Keep TypeScript + Three.js: the simulation uses plain numeric state with no renderer; Three.js remains a presentation dependency and supplies practical WebGL screenshots/video without an engine migration.

Start `npm run dev`, then open `http://localhost:5173/watch.html?scenario=four-wizards&seed=1&variant=baseline&capture=1&time=8`. Capture mode pauses at the nearest 1/60-second simulation tick and uses pixel ratio 1. Live mode uses the same fixed simulation step with a wall-time accumulator. `effects=0`, `trails=0`, and `visualSeed=42` change presentation only. Unknown scenarios or variants fail explicitly.

The browser exposes `window.battle`:

- `metadata`: contract version, scenario, seed, variant, visual seed, fixed timestep, visual options, pixel dimensions.
- `seek(seconds)`: pause, rebuild the scenario, replay fixed ticks from zero, render, and return state.
- `step(count=1)`: pause, advance exactly this many simulation ticks, render, and return state.
- `render()`, `state()`, `screenshot()` (PNG data URL), `pause()`, `play()`.

The Carthage image installs ffmpeg and the Chromium browser/runtime libraries at build time. The Playwright installer version is read from `package-lock.json`; browsers live at `/opt/playwright-browsers` through `PLAYWRIGHT_BROWSERS_PATH`, outside workspace and agent-cache mounts. The final image layer runs Chromium as the normal `carthage` user and verifies software WebGL2 pixel output. A missing library or broken browser causes `carthage build` to fail rather than surfacing during a later capture.

On the host, run `carthage build`, then recreate the sandbox so it uses the new image. Rebuild after Playwright lockfile upgrades. No runtime browser download is needed in the rebuilt Carthage image. Outside Carthage, install Chromium/runtime dependencies for the locked Playwright version (`npx playwright install --with-deps chromium`).

Start `npm run dev`, then run:

```
npm run capture -- --seed 1 --time 8 --out captures/example-still
npm run capture -- --seed 1 --time 8 --duration 2 --fps 30 --out captures/example-clip
```

The script saves PNG frames and `capture.json` containing identifiers, times and states. With ffmpeg available it also encodes `clip.mp4`. `--url`, `--scenario`, `--variant`, `--visualSeed`, `--rotation` (radians), `--effects`, `--trails`, `--width` and `--height` are supported. Frame rates must divide the simulation's 60 Hz; every capture frame advances a whole number of ticks. Duration uses `round(duration*fps)` frames starting at the selected tick. Capture URLs and metadata identify a reproducible run; preserve the source revision/package lock alongside artifacts for durable comparisons. Pixel-identical output requires the same viewport/browser/GPU stack; gameplay state does not.

`BattleView` owns and disposes all dynamic graphics. It reads persistent spell/contestant state and semantic events. Telegraph damage-area outlines use authoritative radii; charge progress uses authoritative countdowns. Impact/blink particles derive initial velocities from `(visualSeed,event.seq)` and evaluate their motion analytically at `world.time-event.t`, so a render never advances an effect or consumes gameplay RNG. Effects live 0.65 seconds, fitting within World's two-second event window. Snapshot rendering needs this event history, including sequence numbers, timestamps and metadata.

Projectile trails need the last 0.2 seconds of actual positions because homing and slowing make linear extrapolation inaccurate. Call `view.recordTick()` after every simulation tick regardless of render frequency; it keeps that bounded history and copies numeric positions. Rebuilding from time zero and recording each tick restores history for seek. Persistent state plus recent semantic events alone cannot restore trails; a future checkpoint format must also store that history (or replay at least 0.2 seconds from an earlier checkpoint). The current API intentionally replays from zero rather than serializing partially mutable AI state.

The adapter contains small shared glow/ring/disposal primitives and distinct spell views. It does not add a universal effect framework, an engine plugin interface, or an ECS. New mechanics expose persistent state and meaningful events; presentation can add bespoke views without changing authoritative rules.

For application browser verification, run `npm run check:browser`. It starts an isolated local Vite server, checks browser/headless agreement for two four-way fights and a rotated duel, compares replay screenshots byte-for-byte, tests different visual settings/render schedules, resize and live playback, and fails on browser errors. After `npm run build`, run `npm run check:browser -- --production` to check the built bundle instead. These checks use Chromium from the image; no separate development server is needed. The image-level WebGL smoke check verifies browser capability; application checks verify the game. Actual clip generation remains available through the capture command above.
