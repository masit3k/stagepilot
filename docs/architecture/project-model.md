# Project model (StagePilot)

## Cíl

`Project` reprezentuje **účel stageplanu**, nikoliv kapelu.  
Rozlišujeme dva typy projektů:

- `event` – jednorázový stageplan pro konkrétní akci
- `generic` – univerzální / sezónní stageplan (bez vazby na konkrétní akci)

Typ projektu je **explicitní** (`purpose`). Aplikace jej **nesmí** odvozovat implicitně.

---

## Terminologie

- **Event metadata**: datum a místo konání konkrétní akce
- **Document metadata**: datum vytvoření/aktualizace a název projektu (tour, sezóna…)

---

## Typ projektu

```ts
export type StagePlanPurpose = "event" | "generic";

export interface Project {
  /** Technický identifikátor projektu */
  id: string;

  /** Reference na kapelu */
  bandRef: string;

  /** Účel stageplanu */
  purpose: StagePlanPurpose;

  /** Datum konání akce (pouze pro purpose = "event") */
  eventDate?: string; // ISO 8601 (YYYY-MM-DD)

  /** Místo konání akce (pouze pro purpose = "event") */
  eventVenue?: string;

  /** Datum vytvoření / aktualizace dokumentu (vždy) */
  documentDate: string; // ISO 8601 (YYYY-MM-DD)

  /** Název projektu (tour / sezóna / poznámka), primárně pro "generic" */
  title?: string;
}

classDiagram
  class Project {
    id: string
    bandRef: string
    purpose: StagePlanPurpose
    eventDate?: string
    eventVenue?: string
    documentDate: string
    title?: string
  }

  class StagePlanPurpose {
    <<union>>
    event
    generic
  }

  Project --> StagePlanPurpose


flowchart TD
  A[Project] --> B{purpose}
  B -->|event| C["Datum akce a místo konání"]
  B -->|generic| D["Název projektu + datum aktualizace"]
