/* PF ARCHIVIO TECNOLOGICO — assistente mascotte
   Motore di animazione CSS-driven: play() imposta solo data-state/data-direction
   sull'SVG e attende animationend. La mappa nome→stato/durata è qui sotto,
   isolata dal resto: l'SVG (assistant-sprite.js) è sostituibile senza toccare
   questa classe. */

import { createAssistantSvg } from "./assistant-sprite.js";

const STORAGE_POSITION = "assistant:position";
const STORAGE_CLOSED = "assistant:closed";

const MOBILE_QUERY = "(max-width: 640px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const SLEEP_AFTER_MS = 60000;
const SLEEP_CHECK_INTERVAL_MS = 5000;
const SECONDARY_IDLE_MIN_MS = 8000;
const SECONDARY_IDLE_MAX_MS = 15000;
const BLINK_MIN_MS = 3000;
const BLINK_MAX_MS = 7000;
const BLINK_DURATION_MS = 180;
const TYPEWRITER_MS = 35;
const BALLOON_AUTOHIDE_MS = 8000;
const DRAG_THRESHOLD_PX = 4;

const ANIMATIONS = {
  idle: { state: "idle", loop: true },
  lookAround: { state: "look-around", loop: false, durationMs: 2400, animationName: "assistant-look-around" },
  wave: { state: "wave", loop: false, durationMs: 1200, animationName: "assistant-wave" },
  point: { state: "point", loop: false, durationMs: 900, animationName: "assistant-point" },
  think: { state: "think", loop: false, durationMs: 2200, animationName: "assistant-think" },
  excited: { state: "excited", loop: false, durationMs: 1000, animationName: "assistant-excited" },
  confused: { state: "confused", loop: false, durationMs: 1400, animationName: "assistant-confused" },
  sleep: { state: "sleep", loop: true },
  exit: { state: "exit", loop: false, durationMs: 500, animationName: "assistant-exit" },
};

const SECONDARY_IDLE_POOL = ["lookAround", "think", "confused"];

export class Assistant {
  #rootEl;
  #el;
  #figureEl;
  #svgEl;
  #balloonEl;
  #balloonTextEl;
  #balloonActionsEl;
  #tabEl;

  #messages;
  #welcomeMessage;
  #randomMessages;
  #startDelayMs;

  #active = null;
  #typing = null;

  #closed = false;
  #destroyed = false;
  #reducedMotion = false;
  #reducedMotionQuery;

  #lastInteractionAt = Date.now();
  #secondaryIdleTimer = null;
  #sleepCheckTimer = null;
  #entranceTimer = null;
  #blinkTimer = null;

  #dragState = null;
  #suppressNextClick = false;

  #shownSections = new Set();
  #sectionObserver = null;

  #bound = {};

  constructor(rootEl, { messages = {}, welcomeMessage = "", randomMessages = [], startDelayMs = 3000 } = {}) {
    this.#rootEl = rootEl;
    this.#messages = messages;
    this.#welcomeMessage = welcomeMessage;
    this.#randomMessages = randomMessages;
    this.#startDelayMs = startDelayMs;

    this.#reducedMotionQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    this.#reducedMotion = this.#reducedMotionQuery.matches;

    this.#bound.onReducedMotionChange = (e) => {
      this.#reducedMotion = e.matches;
    };
    this.#reducedMotionQuery.addEventListener("change", this.#bound.onReducedMotionChange);

    this.#closed = sessionStorage.getItem(STORAGE_CLOSED) === "1";

    this.#buildDom();
    this.#restorePosition();
    this.#attachEvents();
    this.#observeSections();

    if (this.#closed) {
      this.#applyClosedState(false);
    } else {
      this.#entranceTimer = setTimeout(() => this.#playEntrance(), this.#startDelayMs);
    }

    if (!this.#reducedMotion) this.#scheduleBlink();
  }

  /* ---------------------------------------------------------------- DOM */

  #buildDom() {
    this.#el = document.createElement("div");
    this.#el.className = "assistant";
    this.#el.hidden = true;

    this.#figureEl = document.createElement("button");
    this.#figureEl.type = "button";
    this.#figureEl.className = "assistant-figure";
    this.#figureEl.setAttribute("aria-label", "Unità FD.3.5, assistente d'archivio. Attiva per un messaggio.");
    this.#figureEl.innerHTML = createAssistantSvg();
    this.#svgEl = this.#figureEl.querySelector(".assistant-svg");
    this.#svgEl.dataset.state = "idle";

    this.#balloonEl = document.createElement("div");
    this.#balloonEl.className = "assistant-balloon";
    this.#balloonEl.setAttribute("role", "status");
    this.#balloonEl.setAttribute("aria-live", "polite");
    this.#balloonEl.hidden = true;
    this.#balloonEl.innerHTML = `
      <div class="assistant-balloon__bar">
        <span class="assistant-balloon__title">UNITÀ FD.3.5</span>
        <button type="button" class="assistant-balloon__close" aria-label="Chiudi assistente">×</button>
      </div>
      <div class="assistant-balloon__body">
        <p class="assistant-balloon__text"></p>
        <div class="assistant-balloon__actions"></div>
      </div>
      <div class="assistant-balloon__tail"></div>
    `;
    this.#balloonTextEl = this.#balloonEl.querySelector(".assistant-balloon__text");
    this.#balloonActionsEl = this.#balloonEl.querySelector(".assistant-balloon__actions");

    this.#tabEl = document.createElement("button");
    this.#tabEl.type = "button";
    this.#tabEl.className = "assistant-tab";
    this.#tabEl.setAttribute("aria-label", "Riapri l'assistente d'archivio");
    this.#tabEl.textContent = "FD";
    this.#tabEl.hidden = true;

    this.#el.append(this.#balloonEl, this.#figureEl);
    this.#rootEl.append(this.#el, this.#tabEl);
  }

  /* ------------------------------------------------------------ eventi */

  #attachEvents() {
    this.#bound.onFigureClick = () => this.#onFigureClick();
    this.#figureEl.addEventListener("click", this.#bound.onFigureClick);

    this.#bound.onPointerDown = (e) => this.#onPointerDown(e);
    this.#figureEl.addEventListener("pointerdown", this.#bound.onPointerDown);

    this.#bound.onCloseClick = (e) => {
      e.stopPropagation();
      this.hide();
    };
    this.#balloonEl.querySelector(".assistant-balloon__close").addEventListener("click", this.#bound.onCloseClick);

    this.#bound.onBalloonClick = () => this.#skipTypewriter();
    this.#balloonEl.querySelector(".assistant-balloon__body").addEventListener("click", this.#bound.onBalloonClick);

    this.#bound.onTabClick = () => this.show();
    this.#tabEl.addEventListener("click", this.#bound.onTabClick);

    this.#bound.onResize = () => this.#clampToViewport();
    window.addEventListener("resize", this.#bound.onResize);
  }

  #onFigureClick() {
    if (this.#suppressNextClick) {
      this.#suppressNextClick = false;
      return;
    }
    this.#registerInteraction();
    this.#wakeIfAsleep();
    const pool = ["wave", "excited", "confused", "lookAround"];
    const name = pool[Math.floor(Math.random() * pool.length)];
    const text = this.#randomMessages[Math.floor(Math.random() * this.#randomMessages.length)];
    this.play(name).then((completed) => {
      if (completed) this.play("idle");
    });
    if (text) this.say(text);
  }

  #onPointerDown(e) {
    if (window.matchMedia(MOBILE_QUERY).matches) return;
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();

    const rect = this.#el.getBoundingClientRect();
    this.#dragState = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originLeft: rect.left,
      originTop: rect.top,
      width: rect.width,
      height: rect.height,
      moved: false,
    };

    this.#bound.onPointerMove = (ev) => this.#onPointerMove(ev);
    this.#bound.onPointerUp = (ev) => this.#onPointerUp(ev);
    window.addEventListener("pointermove", this.#bound.onPointerMove);
    window.addEventListener("pointerup", this.#bound.onPointerUp);
  }

  #onPointerMove(e) {
    const drag = this.#dragState;
    if (!drag) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;

    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;

    if (!drag.moved) {
      drag.moved = true;
      this.#el.classList.add("is-dragging");
      this.#el.style.right = "auto";
      this.#el.style.bottom = "auto";
    }

    const maxLeft = window.innerWidth - drag.width;
    const maxTop = window.innerHeight - drag.height;
    const left = Math.min(Math.max(drag.originLeft + dx, 0), Math.max(maxLeft, 0));
    const top = Math.min(Math.max(drag.originTop + dy, 0), Math.max(maxTop, 0));

    this.#el.style.left = `${left}px`;
    this.#el.style.top = `${top}px`;
    this.#updateBalloonSide(left);
  }

  #onPointerUp() {
    const drag = this.#dragState;
    window.removeEventListener("pointermove", this.#bound.onPointerMove);
    window.removeEventListener("pointerup", this.#bound.onPointerUp);

    if (drag && drag.moved) {
      this.#el.classList.remove("is-dragging");
      this.#suppressNextClick = true;
      const left = parseFloat(this.#el.style.left) || 0;
      const top = parseFloat(this.#el.style.top) || 0;
      try {
        sessionStorage.setItem(STORAGE_POSITION, JSON.stringify({ left, top }));
      } catch (err) {
        /* sessionStorage non disponibile: la posizione non persiste, non è bloccante */
      }
      this.#registerInteraction();
    }

    this.#dragState = null;
  }

  #restorePosition() {
    if (window.matchMedia(MOBILE_QUERY).matches) return;
    let saved = null;
    try {
      saved = JSON.parse(sessionStorage.getItem(STORAGE_POSITION) || "null");
    } catch (err) {
      saved = null;
    }
    if (!saved) return;
    this.#el.style.right = "auto";
    this.#el.style.bottom = "auto";
    this.#el.style.left = `${saved.left}px`;
    this.#el.style.top = `${saved.top}px`;
    this.#updateBalloonSide(saved.left);
  }

  #clampToViewport() {
    if (this.#el.style.left === "" || this.#el.style.left === "auto") return;
    const rect = this.#el.getBoundingClientRect();
    const maxLeft = window.innerWidth - rect.width;
    const maxTop = window.innerHeight - rect.height;
    const left = Math.min(Math.max(rect.left, 0), Math.max(maxLeft, 0));
    const top = Math.min(Math.max(rect.top, 0), Math.max(maxTop, 0));
    this.#el.style.left = `${left}px`;
    this.#el.style.top = `${top}px`;
  }

  #updateBalloonSide(leftPx) {
    const side = leftPx + this.#el.offsetWidth / 2 > window.innerWidth / 2 ? "left" : "right";
    this.#el.dataset.side = side;
  }

  /* --------------------------------------------------------- sezioni */

  #observeSections() {
    const sections = document.querySelectorAll("main [data-section]");
    if (!sections.length) return;

    this.#sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) this.#onSectionEnter(entry.target.id);
        });
      },
      { threshold: 0.5 }
    );
    sections.forEach((section) => this.#sectionObserver.observe(section));
  }

  #onSectionEnter(id) {
    if (this.#closed || this.#shownSections.has(id)) return;
    const text = this.#messages[id];
    if (!text) return;
    this.#shownSections.add(id);
    this.play("point", { direction: "up" }).then((completed) => {
      if (completed) this.play("idle");
    });
    this.say(text);
  }

  /* ------------------------------------------------------------ ciclo */

  async #playEntrance() {
    if (this.#destroyed || this.#closed) return;
    this.show();
    const completed = await this.play("wave");
    if (completed) await this.play("idle");
    if (this.#welcomeMessage) this.say(this.#welcomeMessage);
    this.#scheduleSleepCheck();
  }

  #registerInteraction() {
    this.#lastInteractionAt = Date.now();
  }

  #wakeIfAsleep() {
    if (this.#svgEl.dataset.state === "sleep") {
      this.play("idle");
    }
  }

  #scheduleSleepCheck() {
    clearInterval(this.#sleepCheckTimer);
    this.#sleepCheckTimer = setInterval(() => {
      if (this.#destroyed || this.#closed) return;
      if (this.#svgEl.dataset.state === "sleep") return;
      if (Date.now() - this.#lastInteractionAt >= SLEEP_AFTER_MS) {
        clearTimeout(this.#secondaryIdleTimer);
        this.play("sleep");
      }
    }, SLEEP_CHECK_INTERVAL_MS);
  }

  #scheduleBlink() {
    clearTimeout(this.#blinkTimer);
    if (this.#destroyed || this.#reducedMotion) return;
    const delay = BLINK_MIN_MS + Math.random() * (BLINK_MAX_MS - BLINK_MIN_MS);
    this.#blinkTimer = setTimeout(() => {
      const state = this.#svgEl.dataset.state;
      if (state === "idle") {
        this.#svgEl.classList.add("is-blinking");
        setTimeout(() => this.#svgEl.classList.remove("is-blinking"), BLINK_DURATION_MS);
      }
      this.#scheduleBlink();
    }, delay);
  }

  #scheduleSecondaryIdle() {
    clearTimeout(this.#secondaryIdleTimer);
    if (this.#destroyed || this.#closed) return;
    const delay = SECONDARY_IDLE_MIN_MS + Math.random() * (SECONDARY_IDLE_MAX_MS - SECONDARY_IDLE_MIN_MS);
    this.#secondaryIdleTimer = setTimeout(async () => {
      if (this.#destroyed || this.#svgEl.dataset.state !== "idle") return;
      const pick = SECONDARY_IDLE_POOL[Math.floor(Math.random() * SECONDARY_IDLE_POOL.length)];
      const completed = await this.play(pick);
      if (completed) await this.play("idle");
    }, delay);
  }

  /* -------------------------------------------------------- API play */

  play(name, opts = {}) {
    const config = ANIMATIONS[name];
    if (!config) {
      console.warn(`[Assistant] animazione sconosciuta: "${name}"`);
      return Promise.resolve();
    }

    this.#interruptActive();
    this.#registerInteraction();

    if (opts.direction) {
      this.#svgEl.dataset.direction = opts.direction;
    } else {
      delete this.#svgEl.dataset.direction;
    }

    this.#svgEl.dataset.state = config.state;

    if (name !== "sleep") {
      this.#scheduleSecondaryIdle();
    }

    if (name === "think" && this.#balloonEl.hidden) {
      this.#balloonActionsEl.innerHTML = "";
      this.#balloonTextEl.textContent = "...";
      this.#balloonEl.hidden = false;
      setTimeout(() => {
        if (this.#balloonTextEl.textContent === "...") this.#balloonEl.hidden = true;
      }, config.durationMs);
    }

    if (config.loop || this.#reducedMotion) {
      return Promise.resolve(true);
    }

    return new Promise((resolve) => {
      let settled = false;
      const finish = (completed) => {
        if (settled) return;
        settled = true;
        this.#svgEl.removeEventListener("animationend", onEnd);
        clearTimeout(timeoutId);
        if (this.#active && this.#active.finish === finish) this.#active = null;
        resolve(completed);
      };
      const onEnd = (event) => {
        if (event.animationName === config.animationName) finish(true);
      };
      const timeoutId = setTimeout(() => finish(true), config.durationMs + 200);
      this.#svgEl.addEventListener("animationend", onEnd);
      this.#active = { name, finish };
    });
  }

  /**
   * Interrompe l'animazione in corso, se presente. Il chiamante originale
   * riceve `false` (non `true`) dalla sua Promise: le catene interne
   * (`play(x).then(() => play('idle'))`) controllano questo valore per non
   * proseguire con un passo successivo quando sono state interrotte da
   * un'interazione più recente — altrimenti una `play()` innescata
   * dall'utente verrebbe sovrascritta quasi subito dalla sequenza
   * precedente che si "risveglia" pensando di essere arrivata in fondo.
   */
  #interruptActive() {
    if (this.#active) {
      this.#active.finish(false);
      this.#active = null;
    }
  }

  /* --------------------------------------------------------- API say */

  say(text, opts = {}) {
    this.#skipTypewriter(true);

    this.#balloonEl.hidden = false;
    this.#balloonTextEl.textContent = "";
    this.#balloonActionsEl.innerHTML = "";
    clearTimeout(this.#typing?.autohideTimer);

    return new Promise((resolve) => {
      const finishText = () => {
        this.#balloonTextEl.textContent = text;
        this.#typing = null;

        if (opts.buttons && opts.buttons.length) {
          this.#renderBalloonButtons(opts.buttons, resolve);
        } else {
          const autohideTimer = setTimeout(() => {
            if (!this.#balloonEl.hidden) this.#balloonEl.hidden = true;
          }, BALLOON_AUTOHIDE_MS);
          this.#typing = { autohideTimer };
          resolve(undefined);
        }
      };

      if (this.#reducedMotion) {
        finishText();
        return;
      }

      let index = 0;
      const interval = setInterval(() => {
        index += 1;
        this.#balloonTextEl.textContent = text.slice(0, index);
        if (index >= text.length) {
          clearInterval(interval);
          finishText();
        }
      }, TYPEWRITER_MS);

      this.#typing = {
        interval,
        skip: () => {
          clearInterval(interval);
          finishText();
        },
      };
    });
  }

  #renderBalloonButtons(buttons, resolve) {
    buttons.slice(0, 2).forEach((btn) => {
      const buttonEl = document.createElement("button");
      buttonEl.type = "button";
      buttonEl.className = "assistant-balloon__action";
      buttonEl.textContent = btn.label;
      buttonEl.addEventListener("click", () => {
        this.#rootEl.dispatchEvent(
          new CustomEvent("assistant:response", { detail: { id: btn.id }, bubbles: true })
        );
        this.#balloonEl.hidden = true;
        resolve({ id: btn.id });
      });
      this.#balloonActionsEl.append(buttonEl);
    });
  }

  #skipTypewriter(silent = false) {
    if (this.#typing?.skip) {
      this.#typing.skip();
    } else if (!silent && this.#typing?.autohideTimer) {
      clearTimeout(this.#typing.autohideTimer);
      this.#balloonEl.hidden = true;
      this.#typing = null;
    }
  }

  /* --------------------------------------------------- show/hide/destroy */

  show() {
    if (this.#destroyed) return;
    this.#closed = false;
    try {
      sessionStorage.removeItem(STORAGE_CLOSED);
    } catch (err) {
      /* non bloccante */
    }
    this.#el.hidden = false;
    this.#tabEl.hidden = true;
    this.#svgEl.dataset.state = "idle";
    this.#registerInteraction();
    if (!this.#reducedMotion) this.#scheduleBlink();
    this.#scheduleSecondaryIdle();
    this.#scheduleSleepCheck();
  }

  hide() {
    if (this.#destroyed) return;
    if (this.#reducedMotion) {
      this.#applyClosedState(true);
      return;
    }
    this.play("exit").then((completed) => {
      if (completed) this.#applyClosedState(true);
    });
  }

  #applyClosedState(persist) {
    this.#closed = true;
    this.#el.hidden = true;
    this.#balloonEl.hidden = true;
    this.#tabEl.hidden = false;
    clearTimeout(this.#secondaryIdleTimer);
    if (persist) {
      try {
        sessionStorage.setItem(STORAGE_CLOSED, "1");
      } catch (err) {
        /* non bloccante */
      }
    }
  }

  destroy() {
    this.#destroyed = true;

    clearTimeout(this.#entranceTimer);
    clearTimeout(this.#secondaryIdleTimer);
    clearTimeout(this.#blinkTimer);
    clearInterval(this.#sleepCheckTimer);
    clearInterval(this.#typing?.interval);
    clearTimeout(this.#typing?.autohideTimer);
    this.#interruptActive();

    this.#reducedMotionQuery.removeEventListener("change", this.#bound.onReducedMotionChange);
    window.removeEventListener("resize", this.#bound.onResize);
    window.removeEventListener("pointermove", this.#bound.onPointerMove);
    window.removeEventListener("pointerup", this.#bound.onPointerUp);

    if (this.#sectionObserver) this.#sectionObserver.disconnect();

    this.#figureEl.removeEventListener("click", this.#bound.onFigureClick);
    this.#figureEl.removeEventListener("pointerdown", this.#bound.onPointerDown);
    this.#balloonEl.querySelector(".assistant-balloon__close")?.removeEventListener("click", this.#bound.onCloseClick);
    this.#balloonEl.querySelector(".assistant-balloon__body")?.removeEventListener("click", this.#bound.onBalloonClick);
    this.#tabEl.removeEventListener("click", this.#bound.onTabClick);

    this.#el.remove();
    this.#tabEl.remove();
  }
}
