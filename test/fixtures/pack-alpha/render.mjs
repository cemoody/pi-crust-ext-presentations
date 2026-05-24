export function renderSlide(layout, slots) {
  return `<section data-layout="${layout}">${JSON.stringify(slots ?? {})}</section>`;
}
