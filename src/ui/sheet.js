import { icon } from "./kit.js";

// Sheets and dialogs: a panel over the page, which waits behind it. Opening one
// adds an entry to the history, so the phone's Back closes it and the page stays;
// so do Esc, its close button and a tap outside it. It's a modal <dialog>, which
// keeps the focus inside it and puts it back where it was.
//
// The router (main.js) asks sheetBack() whether a step through the history was a
// sheet's, and calls dropSheets() before it shows another page.

const open = []; // the sheets that are open, the top one last
let leaving = 0; // sheets closed here whose step back the history hasn't made yet
let count = 0;

// Opens a sheet headed `title` over `body` (markup), with any classes in `cls`.
// Returns { el, $, close }: its element, a querySelector for it, and a function
// that closes it. `onClose` runs however it's closed.
export function openSheet({ title, body, cls = "", onClose }) {
  const el = document.createElement("dialog");
  const id = `sheet-${++count}`;
  el.className = `sheet${cls && ` ${cls}`}`;
  el.setAttribute("aria-labelledby", id);
  el.innerHTML = `<header><h2 id="${id}">${title}</h2><button class="icon-btn" data-close aria-label="Close">${icon("close")}</button></header>
    <div class="sheet-body">${body}</div>`;
  document.body.append(el);

  const sheet = {
    el,
    $: (sel) => el.querySelector(sel),
    // Off the screen, leaving the history alone.
    remove() {
      const i = open.indexOf(sheet);
      if (i < 0) return false;
      open.splice(i, 1);
      if (el.open) el.close?.();
      el.remove();
      onClose?.();
      return true;
    },
    // Closed, and back over its entry in the history.
    close() {
      if (!sheet.remove()) return;
      leaving++;
      history.back();
    },
  };

  el.querySelector("[data-close]").addEventListener("click", sheet.close);
  // A tap outside the panel lands on the dialog itself: on its backdrop.
  el.addEventListener("click", (e) => {
    if (e.target !== el) return;
    const box = el.getBoundingClientRect();
    if (e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom) sheet.close();
  });
  // Esc, and on Android the Back button, which closes a dialog before it goes back.
  el.addEventListener("cancel", (e) => {
    e.preventDefault();
    sheet.close();
  });
  // Keys pressed in a sheet are the sheet's: the page under it doesn't hear them.
  el.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key !== "Escape") return;
    e.preventDefault();
    sheet.close();
  });

  open.push(sheet);
  history.pushState({ sheet: true }, "");
  if (el.showModal) el.showModal();
  else el.setAttribute("open", ""); // a browser from before <dialog>: over the page, but not modal
  return sheet;
}

// For the router, when the history has moved: true if that was a sheet's doing
// (the step back after closing one here, or Back pressed with one open, which
// closes it), so the page stays as it is.
export function sheetBack() {
  if (leaving) {
    leaving--;
    return true;
  }
  return !!open.at(-1)?.remove();
}

// For the router, before another page: closes every sheet, and says if there was
// one, so that the page can take the sheet's place in the history.
export function dropSheets() {
  const any = open.length > 0;
  while (open.length) open.at(-1).remove();
  return any;
}
