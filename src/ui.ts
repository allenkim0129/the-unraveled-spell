import { t } from './i18n';
import type { MessageKey } from './i18n';

function text(key: MessageKey): string {
  return `<span data-i18n="${key}">${t(key)}</span>`;
}

export const markup = `
  <div class="game-shell">
    <header class="masthead">
      <div class="brand"><span class="brand-mark" aria-hidden="true">✧</span><div>
        <h1>Magical <span>Time</span></h1>
        <p>${text('academy')} <span class="prototype-tag" data-i18n="prototype"></span></p>
      </div></div>
      <div class="header-actions">
        <select id="language" data-i18n-aria="language" class="language-select">
          <option value="ko">한국어</option><option value="en">English</option>
        </select>
        <button id="help" class="quiet-button" data-i18n-aria="helpAria">${text('help')} <kbd>H</kbd></button>
        <button id="audio-settings" class="quiet-button" data-i18n="audio"></button>
        <button id="reset" class="quiet-button">${text('reset')} <kbd>R</kbd></button>
      </div>
    </header>
    <main class="play-area">
      <section class="stage" data-i18n-aria="playArea">
        <div id="scene"></div>
        <div class="scene-vignette" aria-hidden="true"></div>
        <div class="top-hud">
          <div class="room-title"><span class="eyebrow" data-i18n="chamber"></span><h2 data-i18n="roomTitle"></h2></div>
          <div class="resources">
            <div><span class="stat-label" data-i18n="stitches"></span><strong id="stitches"></strong></div>
            <div><span class="stat-label" data-i18n="timeState"></span><strong id="phase"></strong></div>
          </div>
        </div>
        <div id="execution-bar" class="execution-bar" hidden>
          <div>${text('weavingTime')}<strong id="timer"></strong></div>
          <progress id="progress" max="5" value="0" data-i18n-aria="progressAria"></progress>
        </div>
        <div id="sight-badge" class="sight-badge" data-i18n="sightBadge" hidden></div>
        <div id="toast" class="toast" role="status" aria-live="polite" hidden></div>
        <div id="ambient-caption" class="ambient-caption" role="status" aria-live="polite" hidden></div>
        <div id="success" class="success-card" hidden>
          <span class="eyebrow" data-i18n="restored"></span>
          <h2 data-i18n="successTitle"></h2><p data-i18n="restoredBody"></p>
          <p id="ending-call"></p><blockquote data-i18n="endingQuote"></blockquote>
          <button id="replay" class="primary-button" data-i18n="replay"></button>
          <small data-i18n="scopeEnd"></small>
        </div>
        <div class="bottom-controls">
          <div class="movement">
            <div id="joystick" class="joystick" data-i18n-aria="joystickAria">
              <span class="joystick-label" data-i18n="move" aria-hidden="true"></span><div id="knob" class="knob"></div>
            </div>
            <span class="desktop-hint" data-i18n-html="desktopHint"></span>
          </div>
          <div class="action-controls">
            <button id="sight" class="action-button sight-button" aria-pressed="false">${text('sight')} <kbd>E</kbd></button>
            <button id="interact" class="action-button" disabled></button>
            <button id="execute" class="action-button execute-button"></button>
          </div>
        </div>
        <p class="camera-hint" data-i18n="cameraHint"></p>
      </section>
      <aside class="sidebar" data-i18n-aria="sidebarAria">
        <div class="mission">
          <span class="eyebrow" data-i18n="objective"></span><h2 data-i18n-html="missionTitle"></h2>
          <p data-i18n="missionBody"></p>
          <ol class="steps">
            <li><span>01</span><div><strong data-i18n="observe"></strong><p data-i18n="observeBody"></p></div></li>
            <li><span>02</span><div><strong data-i18n="edit"></strong><p data-i18n="editBody"></p></div></li>
            <li><span>03</span><div><strong data-i18n="execution"></strong><p data-i18n="executionBody"></p></div></li>
          </ol>
        </div>
        <section id="editor" class="editor" hidden aria-labelledby="editor-title">
          <div class="editor-header"><span class="eyebrow" data-i18n="editor"></span><button id="close-editor" class="close-button" data-i18n-aria="closeEditor">×</button></div>
          <h2 id="editor-title"></h2><p id="connection" class="connection"></p><div id="targets" class="targets"></div>
          <button id="cut" class="cut-button" data-i18n="cut"></button>
          <p class="editor-note" data-i18n-html="editorNote"></p>
        </section>
        <div class="sidebar-bottom">
          <button id="journal" class="quiet-button journal-button" data-i18n="journal"></button>
          <button id="undo" class="quiet-button undo-button" disabled>${text('undo')} <kbd>Z</kbd></button>
          <p class="legend"><span class="force-dot"></span>${text('forceLegend')}<span class="motion-dot"></span>${text('motionLegend')}</p>
          <p class="scope-note" data-i18n-html="scopeNote"></p>
        </div>
      </aside>
    </main>
    <footer class="status-line"><span class="status-dot" aria-hidden="true"></span><p id="outcome"></p></footer>
  </div>
  <dialog id="instructions" aria-labelledby="intro-title">
    <div class="intro-content">
      <div class="intro-top"><span class="eyebrow">MAGICAL TIME</span>
        <select id="intro-language" data-i18n-aria="language" class="language-select">
          <option value="ko">한국어</option><option value="en">English</option>
        </select>
      </div>
      <h2 id="intro-title" data-i18n-html="introTitle"></h2><p class="intro-lead" data-i18n-html="introLead"></p>
      <div class="intro-steps">
        <div><span>◈</span><strong data-i18n="introSight"></strong><p data-i18n-html="introSightBody"></p></div>
        <div><span>✂</span><strong data-i18n="introEdit"></strong><p data-i18n-html="introEditBody"></p></div>
        <div><span>▷</span><strong data-i18n="introExecute"></strong><p data-i18n-html="introExecuteBody"></p></div>
      </div>
      <div class="intro-controls" data-i18n-html="introControls"></div>
      <p class="retry-note" data-i18n-html="retryNote"></p>
      <label class="name-label"><span data-i18n="studentName"></span>
        <input id="student-name" maxlength="24" value="Ari" autocomplete="off" />
      </label>
      <button id="start" class="primary-button"></button>
      <p class="audio-status" data-i18n="audioStartNote"></p>
      <small data-i18n="introFootnote"></small>
    </div>
  </dialog>
  <dialog id="story" aria-labelledby="story-title">
    <div class="intro-content">
      <div class="editor-header"><span class="eyebrow">MAGICAL TIME</span>
        <select id="story-language" data-i18n-aria="language" class="language-select">
          <option value="ko">한국어</option><option value="en">English</option>
        </select>
        <button id="close-story" class="close-button" data-i18n-aria="closeStory">×</button>
      </div>
      <h2 id="story-title"></h2>
      <p id="story-draft" class="retry-note" data-i18n="draftNotice" hidden></p>
      <p id="story-body" class="story-body"></p>
      <p id="voice-status" class="audio-status" role="status"></p>
      <div class="voice-actions">
        <button id="replay-voice" class="quiet-button" data-i18n="replayVoice"></button>
        <button id="story-audio" class="quiet-button" data-i18n="audio"></button>
      </div>
      <div id="cast-controls" hidden>
        <label class="name-label"><span data-i18n="wordLabel"></span>
          <select id="cast-word"><option>Lumen</option><option>Umbra</option><option>Vinculum</option></select>
        </label>
        <p data-i18n="gestureLabel"></p><output id="gesture-sequence">—</output>
        <div class="gesture-buttons">
          <button data-gesture="up" aria-label="↑">↑</button><button data-gesture="right" aria-label="→">→</button>
          <button data-gesture="down" aria-label="↓">↓</button><button data-gesture="left" aria-label="←">←</button>
        </div>
        <button id="clear-gesture" class="quiet-button" data-i18n="clearGesture"></button>
      </div>
      <p id="story-error" class="retry-note" role="status" hidden></p>
      <div id="story-choices" class="story-choices"></div>
    </div>
  </dialog>
  <dialog id="audio-dialog" aria-labelledby="audio-title">
    <div class="intro-content">
      <div class="editor-header"><h2 id="audio-title" data-i18n="audioTitle"></h2>
        <button id="close-audio" class="close-button" data-i18n-aria="closeStory">×</button>
      </div>
      <select id="audio-language" data-i18n-aria="language" class="language-select">
        <option value="ko">한국어</option><option value="en">English</option>
      </select>
      <p data-i18n="audioNote"></p>
      <button id="audio-toggle" class="quiet-button"></button>
      <label class="volume-control"><span data-i18n="effectsVolume"></span>
        <input id="volume-effects" type="range" min="0" max="100" value="30" /><output id="value-effects">30%</output>
      </label>
      <label class="volume-control"><span data-i18n="ambienceVolume"></span>
        <input id="volume-ambience" type="range" min="0" max="100" value="20" /><output id="value-ambience">20%</output>
      </label>
      <label class="volume-control"><span data-i18n="voiceVolume"></span>
        <input id="volume-voice" type="range" min="0" max="100" value="75" /><output id="value-voice">75%</output>
      </label>
      <p id="audio-status" class="audio-status" role="status"></p>
    </div>
  </dialog>
  <div id="fatal-error" class="fatal-error" role="alert" hidden>
    <select id="fatal-language" data-i18n-aria="language" class="language-select">
      <option value="ko">한국어</option><option value="en">English</option>
    </select>
    <h2 data-i18n="fatalTitle"></h2><p id="fatal-message"></p><p data-i18n="fatalHelp"></p>
  </div>
`;
