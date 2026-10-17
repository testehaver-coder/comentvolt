/* Small interaction helpers for the builder: chip inputs for word lists, live character counters
   and inserting a variable at the cursor. Plain functions on window.chatmanyUi, used by app.js. */
(function () {
  const escHtml = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  /**
   * Turn `host` into a chip input. Enter, comma or Tab adds what was typed (also on blur);
   * Backspace on an empty field removes the last chip; × removes one. Duplicates are ignored,
   * case-insensitively. `onChange` receives the new list after every change.
   */
  function chipInput(host, { values, placeholder, inputId, onChange }) {
    let list = [...values];
    host.classList.add("chip-input");

    const render = () => {
      host.innerHTML =
        list
          .map((v, i) => `<span class="chip-tag">${escHtml(v)}<button type="button" data-i="${i}" aria-label="×">×</button></span>`)
          .join("") + `<input type="text" id="${inputId}" placeholder="${escHtml(list.length ? "" : placeholder)}" autocomplete="off"/>`;
      const input = host.querySelector("input");
      input.onkeydown = (e) => {
        if (["Enter", ",", "Tab"].includes(e.key) && input.value.trim()) {
          e.preventDefault();
          add(input.value);
        } else if (e.key === "Backspace" && !input.value && list.length) {
          list = list.slice(0, -1);
          commit();
        }
      };
      input.onblur = () => input.value.trim() && add(input.value, false);
      host.querySelectorAll("button[data-i]").forEach((b) => {
        b.onclick = () => {
          list = list.filter((_, i) => i !== Number(b.dataset.i));
          commit();
        };
      });
    };

    const commit = (focus = true) => {
      render();
      onChange([...list]);
      if (focus) host.querySelector("input").focus();
    };

    const add = (raw, focus = true) => {
      const words = String(raw).split(",").map((w) => w.trim()).filter(Boolean);
      for (const w of words) if (!list.some((x) => x.toLowerCase() === w.toLowerCase())) list = [...list, w];
      commit(focus);
    };

    host.onclick = (e) => {
      if (e.target === host) host.querySelector("input").focus();
    };
    render();
    return { add, values: () => [...list] };
  }

  /** Live "n/max" counters for every field in `root` that has a data-max attribute. */
  function counters(root) {
    root.querySelectorAll("[data-max]").forEach((field) => {
      const max = Number(field.dataset.max);
      const counter = document.createElement("span");
      counter.className = "char-count";
      field.insertAdjacentElement("afterend", counter);
      const paint = () => {
        const n = [...field.value].length;
        counter.textContent = `${n}/${max}`;
        counter.classList.toggle("over", n > max);
        counter.classList.toggle("near", n <= max && n >= max * 0.9);
      };
      field.addEventListener("input", paint);
      paint();
    });
  }

  /** Insert `text` at the cursor of `field` and fire an input event so bindings pick it up. */
  function insertAtCursor(field, text) {
    const start = field.selectionStart ?? field.value.length;
    const end = field.selectionEnd ?? field.value.length;
    field.value = field.value.slice(0, start) + text + field.value.slice(end);
    field.focus();
    field.selectionStart = field.selectionEnd = start + text.length;
    field.dispatchEvent(new Event("input", { bubbles: true }));
  }

  window.chatmanyUi = { chipInput, counters, insertAtCursor };
})();
