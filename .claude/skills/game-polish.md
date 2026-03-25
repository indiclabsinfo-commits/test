---
description: "Polish and enhance any casino/board game with Ludo King-quality effects, sounds, and visuals"
---

# Game Polish Skill

## What This Skill Does
Apply casino-grade polish to any game in the project, matching the quality bar set by the Ludo game overhaul. The Ludo implementation is the gold standard -- every other game should reach the same level of visual richness, audio feedback, and animation quality.

## The Polish Checklist (apply to every game)

### 1. Visual Polish
- [ ] Rich color palette with CSS custom properties (vibrant, saturated colors)
- [ ] 3D-looking elements using layered gradients and shadows
- [ ] Warm cream/ivory backgrounds instead of stark white/gray
- [ ] Gold metallic accents and borders (use `--ludo-gold-bright: #FFD700` pattern)
- [ ] Glossy specular highlights on interactive elements
- [ ] Per-color drop shadows (tinted to match element color, e.g. `box-shadow: 0 0 6px ${color}, 0 0 12px ${color}80`)
- [ ] Premium card/panel styling with backdrop-blur and inner highlights
- [ ] Wood-tone board textures where appropriate (see `--ludo-wood-*` vars)
- [ ] Radial gradients on board zones for depth
- [ ] Inner glow borders on panels (`inset 0 1px 0 rgba(255,255,255,0.05)`)

### 2. Sound Effects (Web Audio API only, no files)
All sounds are generated synthetically via `src/utils/sound.ts`. Zero audio file dependencies.

Available sound functions to use:
- `playClick()` -- short percussive tap for UI buttons
- `playBet()` / `playBetClick()` -- coin clink for bet placement
- `playWin()` / `playWinSound()` / `playWinSoundEnhanced()` -- ascending arpeggio + cymbal shimmer
- `playLoss()` -- descending slide + tension beat
- `playDiceShake()` / `playDiceShakeEnhanced()` -- multi-phase rattle with tumble
- `playDiceLandThud()` -- heavy thud on dice land
- `playSixRolled()` -- triumphant fanfare for lucky rolls
- `playCapture()` / `playCaptureEnhanced()` -- 5-layer devastation (bass + crack + shatter + reverb + chord)
- `playCaptureReturn()` -- piece sent home sound
- `playCoinShower()` -- metallic clink cascade (slot machine payout feel)
- `playCardFlip()` -- card snap sound
- `playWheelTick()` / `playSpinTick()` -- ratchet tick for spinning elements
- `playExplosion()` -- boom for big events
- `playHopSound()` -- piece movement hop
- `playLandingSound()` -- piece landing thunk
- `playPieceMove()` -- subtle movement sound
- `playPieceEntryPop()` -- pop when piece enters play
- `playHomeEntry()` / `playHomeEntryEnhanced()` -- celebration on reaching home/goal
- `playTurnStart()` -- whoosh for turn change
- `playTurnChangeSwoosh()` -- swoosh transition
- `playUrgencyTick(timeLeft?)` -- metronome tick that speeds up as time runs low
- `playTimerWarning()` -- urgent warning beep
- `playPayoutTick()` -- slot-machine payout tick
- `playStreakSound()` / `playStreakBonus(count)` -- escalating streak effects
- `playNearMiss()` -- tension sound for close calls
- `playEmojiPop()` -- pop for emoji reactions
- `playThreeSixesForfeit()` -- negative consequence sound

Sound design principles:
- Every single interaction must have audio feedback -- no silent clicks
- Big events get multi-layer composite sounds (capture = bass + crack + shatter + reverb + chord)
- Wins use ascending pitch patterns, losses use descending
- Coin/payout sounds use metallic timbres with staggered delays (slot machine feel)
- Timer warnings increase in urgency as time decreases
- All sounds route through a master compressor + gain for consistent volume

### 3. Animations
- [ ] 60fps hardware-accelerated (`transform` and `opacity` only, use `will-change` sparingly)
- [ ] Screen shake on big events (captures, wins, explosions) -- use `useScreenShake()` hook pattern
- [ ] Particle effects: confetti (120+ particles with mixed shapes), sparks, coin showers
- [ ] Shockwave rings on impacts (expanding border rings that fade out)
- [ ] Pulsing glow on interactive elements (call-to-action)
- [ ] Bounce/spring easing on state changes (Framer Motion spring physics)
- [ ] Staggered reveals for multiple elements (stagger delays 0.05-0.15s)
- [ ] Low-end device detection: reduce particle counts via `detectLowEnd()` check (`hardwareConcurrency <= 4` or `deviceMemory <= 2`)

Key animation patterns from Ludo:
- **Confetti**: 120 particles, 4 shapes (circle/square/strip/star), 14 colors, wind drift, gravity
- **Capture Explosion**: flash + 3 shockwave rings + 32 shards + 14 sparks + 10 smoke wisps + screen flash overlay
- **Coin Shower**: 25 coins with arc physics (launch up, gravity pulls down), 3D Y-rotation, shine highlights
- **Streak Overlay**: escalating "x2!", "x3!" badges with scale bounce
- **Payout Counter**: animated number that ticks up with coin sounds
- **Screen Edge Glow**: colored glow on viewport edges for player turn indication
- **Board Flash**: brief color wash over the game board on events

### 4. Casino Feel
- [ ] Coin shower effects on wins/captures (`CoinShower` component)
- [ ] Streak multiplier badges ("x2!", "x3!") with `CaptureStreakBonus` overlay
- [ ] Payout counter that ticks up with sound (`PayoutCounter` component)
- [ ] Prediction/progress bars showing game state
- [ ] Dramatic callout overlays for big events (`TurnBanner` with backdrop blur)
- [ ] Gold pulsing borders on important UI elements
- [ ] Capture/kill callouts with player names and colors
- [ ] Trophy animation on game win (`TrophyAnimation`)
- [ ] Near-miss flash effect for dramatic tension (`NearMissFlash`)
- [ ] Urgency vignette that darkens screen edges when timer is low (`UrgencyVignette`)
- [ ] Emoji reaction pops for social interaction (`EmojiReactions`)

### 5. Mobile-First
- [ ] Touch targets minimum 44px (Ludo uses 52px for color dots)
- [ ] Swipe/gesture interactions where appropriate (dice swipe to roll)
- [ ] Safe area insets for notch devices: `padding: calc(env(safe-area-inset-top, 0px) + 16px) ...`
- [ ] Haptic feedback (`navigator.vibrate`) on key events
- [ ] Board/game area fills maximum screen space (`min-height: 100dvh`)
- [ ] Mobile card pattern: `max-width: 420px`, centered, with dark gradient background
- [ ] Font sizes: titles 1.4rem/900 weight, labels 0.72rem/600 weight uppercase, body 0.85rem

## Games to Polish

These are all game components in `src/components/games/` that need the polish treatment:

| Game | File | Status |
|------|------|--------|
| Ludo | `LudoGame.tsx` + `LudoBoard.css` + `ludo/LudoEffects.tsx` + `ludo/LudoEffects.css` | DONE (reference implementation) |
| Blackjack | `BlackjackGame.tsx` | Needs polish |
| Crash | `CrashGame.tsx` | Needs polish |
| Diamonds | `DiamondsGame.tsx` | Needs polish |
| Dice | `DiceGame.tsx` | Needs polish |
| Dragon Tower | `DragonTowerGame.tsx` | Needs polish |
| HiLo | `HiLoGame.tsx` | Needs polish |
| Keno | `KenoGame.tsx` | Needs polish |
| Limbo | `LimboGame.tsx` | Needs polish |
| Mines | `MinesGame.tsx` | Needs polish |
| Plinko | `PlinkoGame.tsx` | Needs polish |
| Roulette | `RouletteGame.tsx` | Needs polish |
| Wheel | `WheelGame.tsx` | Needs polish |
| Generic Placeholder | `GenericGamePlaceholder.tsx` | Low priority |

## Technical Approach

### File Structure (per game)
For each game `XxxGame.tsx`, create:
```
src/components/games/
  XxxGame.tsx          -- game logic + layout (import effects)
  XxxBoard.css         -- all visual styling with CSS custom properties
  xxx/
    XxxEffects.tsx     -- React effect components (confetti, explosions, coin showers, etc.)
    XxxEffects.css     -- keyframe animations and effect styling
```

### CSS Architecture
- Define game-specific CSS custom properties on `:root` (color palette, wood tones, gold accents)
- Use layered `box-shadow` for 3D depth (multiple shadow layers at different offsets)
- Gradient backgrounds: `linear-gradient(180deg, ...)` for panels, `radial-gradient` for board zones
- Premium borders: gold `border` + dark `inset box-shadow` for depth framing
- Panel glass effect: `background: rgba(12, 28, 46, 0.82)` with subtle inner highlight

### React Effects Architecture
- Import `motion` and `AnimatePresence` from `framer-motion`
- Each effect is a self-contained functional component with `useMemo` for particle arrays
- Use `IS_LOW_END` device detection to scale down particle counts (40 vs 120 confetti, etc.)
- Effects auto-dismiss via `useState` + `setTimeout` pattern
- Screen shake via CSS transform on the game container (custom hook `useScreenShake`)
- Coin physics: arc trajectories with `Math.sin/cos` for angle-based spread + gravity factor

### Sound Integration
- Import specific sound functions from `src/utils/sound.ts`
- Sound module uses Web Audio API exclusively -- `AudioContext`, `OscillatorNode`, `GainNode`
- Audio chain: oscillators -> gain envelope -> dynamics compressor -> master gain -> destination
- All sounds check `isSoundEnabled()` via localStorage before playing
- Noise buffer created once and reused for percussion/crash sounds
- No external audio files -- everything is synthesized

### Key Principles
1. **Separation of concerns**: Game logic stays in `XxxGame.tsx`, visual effects in `XxxEffects.tsx`, styling in CSS
2. **Performance budget**: Use `will-change: transform` only on actively animating elements, remove after animation
3. **Progressive enhancement**: Detect low-end devices and reduce particle counts, skip secondary effects
4. **No silent interactions**: Every tap, roll, flip, win, and loss must produce sound
5. **Consistent premium palette**: Gold accents, dark backgrounds, vibrant saturated player colors
6. **Mobile-first always**: Design for 320-430px viewports first, scale up from there
