import { html } from "./dom.js";
import { icon } from "./kit.js";

// A page's back button, top left, which stays there as the page scrolls under it.
// `back` is where it leads.
export const backButton = (back = "/") => `<a class="icon-btn page-back" href="${back}" data-link="up" aria-label="Back">${icon("back")}</a>`;

// A page that's a step in from the menu: its back button and its heading, over
// `markup`. Returns a querySelector for the page, as html() does.
export function frame(el, title, markup, back = "/") {
  return html(el, `${backButton(back)}<h1 class="page-title">${title}</h1>${markup}`);
}
