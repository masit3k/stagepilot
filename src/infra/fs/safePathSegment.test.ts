import { describe, expect, it } from "vitest";
import {
  deriveBandCode,
  normalizeBandCode,
} from "../../domain/band/bandCode.js";
import { toIdSlug } from "../../domain/ids/slug.js";
import {
  formatProjectSlug,
  generateUuidV7,
} from "../../domain/projectNaming.js";
import { assertSafePathSegment, toSafeFileName } from "./safePathSegment.js";

/** Id a slugy, které aplikace dnes skutečně vyrábí — žádné nesmí být odmítnuto ani změněno. */
const generatedIds = [
  generateUuidV7(),
  generateUuidV7(new Date("2020-02-29T23:59:59.999Z")),
  toIdSlug("Matěj Krečmer"),
  toIdSlug("Žluťoučký kůň & spol. – 2026"),
  toIdSlug("x".repeat(80)),
  "20261112-104512-123",
  "20261112-104512-123-1",
  "contact-1",
  "test-band",
  "notes_default_cs",
];

const bandCodes = [
  deriveBandCode("Couvert"),
  deriveBandCode("The Party Band Prague"),
  deriveBandCode("Žlutý Pes"),
  normalizeBandCode("cvt 2"),
  "PB",
  "ABC123",
];

const generatedSlugs = bandCodes.flatMap((code) => {
  const band = { id: "band-id", code, name: "Band" };
  return [
    formatProjectSlug({ purpose: "generic", documentDate: "2026-11-12" }, band),
    formatProjectSlug(
      {
        purpose: "event",
        eventDate: "2026-11-12",
        eventVenue: "Lucerna – velký sál / Praha 1",
      },
      band,
    ),
    formatProjectSlug(
      {
        purpose: "event",
        eventDate: "2026-11-12",
        eventVenue: 'Žďár nad Sázavou: "Kulturák"',
      },
      band,
    ),
    formatProjectSlug({ purpose: "event" }, { id: "band_id", name: "Band" }),
  ];
});

describe("assertSafePathSegment", () => {
  it.each(generatedIds)("accepts the generated id %s unchanged", (id) => {
    expect(assertSafePathSegment(id, "projectId")).toBe(id);
  });

  it.each(generatedSlugs)("accepts the generated slug %s unchanged", (slug) => {
    expect(assertSafePathSegment(slug, "slug")).toBe(slug);
  });

  it.each([
    ["a path separator", "..\\..\\evil"],
    ["a forward slash", "AC/DC"],
    ["a parent reference", ".."],
    ["a current-directory reference", "."],
    ["an embedded parent reference", "a..b"],
    ["a drive colon", "C:evil"],
    ["a wildcard", "what?"],
    ["a pipe", "a|b"],
    ["angle brackets", "<id>"],
    ["a quote", 'a"b'],
    ["a control character", "a\u0000b"],
    ["a trailing dot", "name."],
    ["a trailing space", "name "],
    ["a reserved device name", "NUL"],
    ["a reserved device name in lower case", "con"],
    ["a reserved device name with an extension", "COM1.json"],
    ["an empty string", ""],
  ])("rejects %s", (_label, value) => {
    expect(() => assertSafePathSegment(value, "projectId")).toThrow(
      /projectId/,
    );
  });

  it("names the offending field in the error", () => {
    expect(() => assertSafePathSegment("../x", "defaultContactId")).toThrow(
      /defaultContactId/,
    );
  });

  it("rejects a value that is not a string", () => {
    expect(() =>
      assertSafePathSegment(undefined as unknown as string, "versionId"),
    ).toThrow(/versionId/);
  });
});

describe("toSafeFileName", () => {
  it.each(generatedSlugs)(
    "keeps the generated PDF name %s.pdf unchanged",
    (slug) => {
      expect(toSafeFileName(`${slug}.pdf`)).toBe(`${slug}.pdf`);
    },
  );

  it("replaces a path separator in a band code, so no subfolder appears", () => {
    expect(toSafeFileName("AC/DC_Inputlist_Stageplan_2026.pdf")).toBe(
      "AC_DC_Inputlist_Stageplan_2026.pdf",
    );
  });

  it("replaces every character Windows does not allow in a name", () => {
    expect(toSafeFileName('a<b>c:d"e\\f|g?h*i.pdf')).toBe(
      "a_b_c_d_e_f_g_h_i.pdf",
    );
  });

  it.each([
    "..\\..\\evil.pdf",
    "../../evil.pdf",
    "..",
    ".",
    "",
    "NUL.pdf",
    "con",
    "name. ",
    "a\u0001b.pdf",
  ])("turns %j into a name that passes the segment check", (raw) => {
    const safe = toSafeFileName(raw);
    expect(assertSafePathSegment(safe, "pdfFileName")).toBe(safe);
  });
});
