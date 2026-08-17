import { fireEvent } from "@testing-library/react";

/**
 * Set a controlled input's value in ONE render.
 *
 * `userEvent.type` dispatches a full event sequence per character, and the dashboard
 * editors re-render their whole section on every keystroke — a 17-character alt text
 * costs 17 full renders and is what used to push these suites past the default 5s
 * timeout. The behaviour under test is the committed value plus the blur/save cycle,
 * not the keystroke sequence, so a single change event is the honest equivalent.
 */
export function setInputValue(el: HTMLElement, value: string) {
  fireEvent.change(el, { target: { value } });
}
