import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractClassAttributes } from "../src/extract.js";

const values = (source: string) => extractClassAttributes(source).attributes.map((attribute) => attribute.value);

describe("extractClassAttributes", () => {
  it("finds double and single quoted static class attributes", () => {
    assert.deepEqual(values(`<a class="a b"></a><b class='c d'></b>`), ["a b", "c d"]);
  });

  it("finds JSX className strings", () => {
    assert.deepEqual(values(`<div className="p-4 flex" />`), ["p-4 flex"]);
  });

  it("reports offsets that point at the value", () => {
    const source = `<div class="a b"></div>`;
    const [attribute] = extractClassAttributes(source).attributes;
    assert.ok(attribute);
    assert.equal(source.slice(attribute.start, attribute.end), "a b");
  });

  it("reports 1-based line numbers, including multi-line values", () => {
    const source = `<p>\n</p>\n<div\n  class="\n    a\n  "\n></div>`;
    const [attribute] = extractClassAttributes(source).attributes;
    assert.ok(attribute);
    assert.equal(attribute.line, 4);
    assert.match(attribute.value, /a/);
  });

  it("ignores bindings and look-alikes", () => {
    const source = [
      `<div :class="{ a: b }"></div>`,
      `<div v-bind:class="x"></div>`,
      `<div [ngClass]="{ a: b }"></div>`,
      `<div [class]="x"></div>`,
      `<div [class.active]="x"></div>`,
      `<div data-class="p-4"></div>`,
      `<div subclass="p-4"></div>`,
      `<div className={cn("a", b)} />`,
    ].join("\n");
    const result = extractClassAttributes(source);
    assert.deepEqual(result.attributes, []);
    assert.equal(result.dynamic, 6);
  });

  it("skips values with interpolation and counts them", () => {
    const result = extractClassAttributes(
      `<div class="a {{ b }}"></div><div class="a {b}"></div><div class="${"$"}{c}"></div>`,
    );
    assert.deepEqual(result.attributes, []);
    assert.equal(result.interpolated, 3);
  });

  it("keeps the other quote character inside a value", () => {
    assert.deepEqual(values(`<div class="a 'b'"></div>`), [`a 'b'`]);
  });
});
