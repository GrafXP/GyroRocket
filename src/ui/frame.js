import { html } from "./dom.js";
import { icon } from "./kit.js";

// A page that's a step in from the menu: its back button, top left, which stays
// there as the page scrolls, and its heading, over `markup`. `back` is where the
// button leads. Returns a querySelector for the page, as html() does.
export function frame(el, title, markup, back = "/") {
  return html(
    el,
    `<a class="icon-btn page-back" href="${back}" data-link="up" aria-label="Back">${icon("back")}</a>
    <h1 class="page-title">${title}</h1>
    ${markup}`,
  );
}
