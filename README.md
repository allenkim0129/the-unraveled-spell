# Magical Time

A **Korean/English, bird's-eye 2.5D web adventure** about a magic-academy student who can still move after a sorcerer freezes humanity. Magical creatures remain active. Your wand casts and alters spells; the book the goddess asks you to find provides knowledge, not instant emotional mastery.

Play: https://allenkim0129.github.io/the-unraveled-spell/

Requires a modern WebGL browser. No installation, account or backend. Language changes preserve gameplay; only language preference is stored across reloads.

## Adventure and controls

Find the book, edit the academy's bridge spells, cross the trail with learned magic, and reach the spell's source. A familiar scarf or the book's journal opens a short playable memory. Move to your friend, face the feeling honestly, and return to your saved present-day position and puzzle edits. Memories do not instantly erase loneliness.

Ordinary casting requires the correct word and an explicit sequence of wand-direction buttons, not freehand gesture recognition. Emotional magic requires understanding feelings rather than suppressing pain. At the source, restoration requires a memory, both discoveries, and emotional mastery before the final five-second execution. Solving the academy bridge only opens the journey; it does not restore humanity.

**Provisional story:** the user approved a playable interpretation in which a bond with a magical creature protected the student, the sorcerer tried to prevent loss by holding people unchanged, and the final emotion is courage to choose connection despite vulnerability. These answers are marked as provisional in-game, not final canon. Understanding the sorcerer's motive does not require forgiveness.

| Action | Desktop | Touch |
| --- | --- | --- |
| Move | WASD / arrows | Left movement pad |
| Aether Sight | E / button | Sight button |
| Nearby interaction | F / button | Contextual interaction button |
| Execute academy spells | Space / button | Execution button |
| Undo last edit | Z / button | Undo button |
| Reset current room | R / button | Reset button |
| Instructions | H / button | Help button |
| Journal / audio / language | On-screen controls | On-screen controls |

Cutting and redirection each cost one of three stitches. Undo restores the last edit and its cost before execution; selecting the current target costs nothing. Execution lasts five active seconds and locks movement/editing. Dialogues, audio settings, instructions and hidden tabs pause execution. Each puzzle attempt executes once; **Reset** restores the current room's position, connections and resources while retaining the book and narrative knowledge. Ending replay restarts the entire journey.

The camera is fixed and oblique orthographic; movement follows screen directions. No rotation or awkward 3D character steering is needed.

## Audio

Start click/tap unlocks locally synthesized footsteps, casting, cutting, pages, creature chirps, wind and bells. **Audio** provides independent effects, ambience/memory-chatter and dialogue volume controls, plus a master mute.

Dialogue and human chatter use the browser's **device-local synthetic voices** in Korean or English. No paid service, external voice request or recorded voice assets are included. Availability depends on the device/browser: when a local voice in the selected language is missing or playback fails, the game explicitly reports the limitation and retains subtitles. It does not silently use a remote or wrong-language voice. The dialogue replay button becomes available when a matching voice exists.

Human chatter is restricted to memories and the restored world, contrasted with silence from frozen humans in the present. Chatter has bilingual on-screen captions. Story dialogue always remains readable. Audio is muted and speech canceled when the page is hidden.

## Development

Node.js 24+ is recommended.

```bash
npm ci
npm run dev
```

Development URL: http://localhost:5173/the-unraveled-spell/

```bash
npm test
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

Linux browsers may require `npx playwright install --with-deps chromium`. The Playwright suite covers desktop and emulated mobile with actual touch events. Production files are in `dist/`; `vite.config.ts` preserves the repository's Pages base path.

## Deployment

Repository **Settings → Pages → Source → GitHub Actions** must be enabled. `.github/workflows/deploy-pages.yml` validates and deploys pushes to `main` and the current development branch `allenkim0129-cautious-adventure`. Its environment branch policy must allow the target branch. The game title change does not rename the repository or public URL.

## Implementation and replaceable sprites

TypeScript, Vite and Three.js. `state.ts` handles deterministic spell editing and execution; `adventure.ts` guards narrative progression and restoration; `scene.ts` renders rooms and movement; `audio.ts` handles local synthesis and speech; `view.ts` fits the fixed camera; `input.ts` tracks keyboard and multitouch; `i18n.ts` contains both languages.

Characters use original procedural placeholder sprite sheets, not final artwork. `CharacterSprite` in `character.ts` draws camera-parallel planes with bottom-center foot anchoring, shadows, alpha testing and depth occlusion.

Sheet format: **4 columns × 4 rows**. Rows face down, left, right, up; column 0 is idle, columns 1–3 walk. Align each frame's feet to the cell's bottom center. Replace its texture and adjust `height` without changing movement or puzzle logic. Walking follows actual movement distance; blocked/idle characters remain still. Reduced-motion preference disables sprite walking.

This is a short adventure prototype, not the full RPG. Combat, elemental splicing, Backlash, persistent gameplay saves, final artwork and a larger world are not included.

## 한국어 안내

**한국어 / English** 선택기로 안내·목표·퍼즐·대사·오류를 전환해도 진행은 유지됩니다. 여신이 부탁한 마법서를 얻고, 관측실의 다리를 복구한 뒤 숲길을 지나 주문의 근원으로 가세요. 사람들만 동결되어 있고 마법 생물들은 계속 움직입니다.

회상에서는 친구에게 걸어가 감정을 마주한 뒤 현재의 위치와 편집 상태로 돌아옵니다. 배운 주문은 단어와 방향 버튼 순서가 필요하고, 마지막 마법은 두 미스터리의 이해와 감정의 숙달이 필요합니다. 방 초기화는 마법서와 이야기 지식을 지우지 않습니다. 결말의 다시 플레이는 여정 전체를 새로 시작합니다.

**소리** 메뉴에서 효과음·환경음/회상 대화·대사 음성을 따로 조절하세요. 기기 내장 한국어 음성이 없으면 그 한계를 표시하고 자막을 제공합니다. 유료 음성이나 녹음 파일은 사용하지 않습니다. 미스터리의 답과 마지막 감정은 플레이 가능한 결말을 위해 승인된 임시 해석이며 최종 설정은 아닙니다.
