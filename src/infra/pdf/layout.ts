export const pdfLayout = {
  page: {
    size: "A4",
    margins: {
      top: "20mm",
      right: "15mm",
      bottom: "15mm",
      left: "15mm",
    },
  },

  typography: {
    fontFamily: "Inter",
    title: { size: "26pt", weight: 700 as const, lineHeight: 1.1 },
    contact: { size: "11pt", weight: 700 as const, lineHeight: 1.3 },
    table: { size: "9pt", lineHeight: 1.2, headerWeight: 700 as const },
  },

  table: {
    colNo: "42pt",
    colInput: "145pt",
    borderPx: 0.5,
    padY: "2pt",
    padX: "6pt",
  },

  ids: {
    page: "page",
    content: "content",
    page2: "page2",
    content2: "content2",
  },
} as const;
