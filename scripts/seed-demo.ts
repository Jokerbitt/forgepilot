/**
 * Seed script — creates realistic demo data for ForgePilot
 * Usage: npx tsx scripts/seed-demo.ts
 *
 * Creates demo files in config/ if they do not already exist.
 * Existing files are never overwritten.
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";

const CONFIG_DIR = join(process.cwd(), "config");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readJson<T>(file: string): T {
  const raw = readFileSync(join(CONFIG_DIR, file), "utf-8");
  return JSON.parse(raw) as T;
}

function writeJson(file: string, data: unknown): void {
  writeFileSync(
    join(CONFIG_DIR, file),
    JSON.stringify(data, null, 2) + "\n",
    "utf-8"
  );
}

function fileExists(file: string): boolean {
  return existsSync(join(CONFIG_DIR, file));
}

function nowIso(offsetMs = 0): string {
  return new Date(Date.now() - offsetMs).toISOString();
}

const DAY = 86_400_000;

// ---------------------------------------------------------------------------
// Demo Project Briefs
// ---------------------------------------------------------------------------

interface Requirement {
  id: string;
  briefId: string;
  type: string;
  title: string;
  description: string;
  priority: string;
  source: string;
  findingIds: string[];
  status: string;
}

interface Risk {
  id: string;
  briefId: string;
  title: string;
  description: string;
  probability: string;
  impact: string;
  mitigationIdea: string;
  isOpenAssumption: boolean;
  findingIds: string[];
}

interface ProjectBrief {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  rawIdea: string;
  problemStatement: string;
  targetAudience: string;
  desiredOutcome: string;
  constraints: string[];
  scope: string;
  researchMode: string;
  privacyMode: string;
  requirements: Requirement[];
  useCases: unknown[];
  nonGoals: string[];
  risks: Risk[];
  researchRunIds: string[];
}

function makeBrief(
  title: string,
  rawIdea: string,
  problemStatement: string,
  targetAudience: string,
  status: string,
  offsetMs: number
): ProjectBrief {
  const id = randomUUID();
  return {
    id,
    title,
    status,
    createdAt: nowIso(offsetMs),
    updatedAt: nowIso(offsetMs / 2),
    rawIdea,
    problemStatement,
    targetAudience,
    desiredOutcome: `Implementierung von: ${rawIdea}`,
    constraints: [],
    scope: "standard",
    researchMode: "quick",
    privacyMode: "local",
    requirements: [
      {
        id: `${id}-req-1`,
        briefId: id,
        type: "functional",
        title: "Kernanforderung umsetzen",
        description: problemStatement,
        priority: "must",
        source: "user_input",
        findingIds: [],
        status: "proposed",
      },
      {
        id: `${id}-req-2`,
        briefId: id,
        type: "non-functional",
        title: "Performance & Skalierbarkeit",
        description: "System muss unter Last stabil und responsiv bleiben.",
        priority: "should",
        source: "ai_generated",
        findingIds: [],
        status: "proposed",
      },
    ],
    useCases: [],
    nonGoals: ["Mobile App in Phase 1", "Multi-Tenant-Setup"],
    risks: [
      {
        id: `${id}-risk-1`,
        briefId: id,
        title: "Ungeprüfte Annahmen",
        description:
          "Die Idee basiert auf Nutzerannahmen und sollte vor Umsetzung validiert werden.",
        probability: "medium",
        impact: "medium",
        mitigationIdea:
          "Research Brief ausführen und Findings mit Quellen prüfen.",
        isOpenAssumption: true,
        findingIds: [],
      },
    ],
    researchRunIds: [],
  };
}

// ---------------------------------------------------------------------------
// Demo Work Items
// ---------------------------------------------------------------------------

interface WorkItem {
  id: string;
  source: string;
  type: string;
  title: string;
  url: string;
  status: string;
  priority: number;
  blocked: boolean;
  risk: string;
  aiDelegable: boolean;
  estimatedMinutes: number;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

function makeWorkItem(
  title: string,
  projectId: string,
  priority: number,
  status: string,
  offsetMs: number
): WorkItem {
  return {
    id: randomUUID(),
    source: "local",
    type: "ticket",
    title,
    url: "",
    status,
    priority,
    blocked: false,
    risk: "B",
    aiDelegable: true,
    estimatedMinutes: 90,
    projectId,
    createdAt: nowIso(offsetMs),
    updatedAt: nowIso(offsetMs / 2),
  };
}

// ---------------------------------------------------------------------------
// Demo Delegations
// ---------------------------------------------------------------------------

interface DelegationContract {
  id: string;
  workItemId: string;
  goal: string;
  context: string;
  taskType: string;
  definitionOfDone: string[];
  riskClass: string;
  maxBudgetUsd: number;
  allowedTools: string[];
  branchStrategy: string;
  requiresApproval: boolean;
  privacyMode: string;
  createdAt: string;
}

interface DelegationLog {
  timestamp: string;
  type: string;
  message: string;
}

interface Delegation {
  id: string;
  title: string;
  contract: DelegationContract;
  status: string;
  executionRoute: string;
  costEstimateUsd: number;
  logs: DelegationLog[];
  createdAt: string;
  updatedAt: string;
}

function makeDelegation(
  title: string,
  workItemId: string,
  goal: string,
  status: string,
  riskClass: string,
  offsetMs: number
): Delegation {
  const id = randomUUID();
  const contractId = randomUUID();
  const logs: DelegationLog[] = [
    {
      timestamp: nowIso(offsetMs),
      type: "info",
      message: `Delegation "${title}" erstellt (Risk ${riskClass})`,
    },
  ];
  if (status === "approved" || status === "completed") {
    logs.push({
      timestamp: nowIso(offsetMs / 2),
      type: "info",
      message: "Delegation genehmigt — bereit zur Ausführung",
    });
  }
  if (status === "completed") {
    logs.push({
      timestamp: nowIso(offsetMs / 4),
      type: "success",
      message: "Ausführung erfolgreich abgeschlossen",
    });
  }
  return {
    id,
    title,
    contract: {
      id: contractId,
      workItemId,
      goal,
      context:
        "Kontext aus Project Brief extrahiert. Alle relevanten Requirements sind bekannt.",
      taskType: "feature",
      definitionOfDone: [
        "Tests green",
        "TypeScript 0 errors",
        "PR erstellt und reviewed",
      ],
      riskClass,
      maxBudgetUsd: 5,
      allowedTools: ["bash", "read_file", "write_file"],
      branchStrategy: "feature",
      requiresApproval: riskClass === "C",
      privacyMode: "local",
      createdAt: nowIso(offsetMs),
    },
    status,
    executionRoute: "claude-code",
    costEstimateUsd: status === "completed" ? 0.84 : 0,
    logs,
    createdAt: nowIso(offsetMs),
    updatedAt: nowIso(offsetMs / 4),
  };
}

// ---------------------------------------------------------------------------
// Demo Orchestrated Run
// ---------------------------------------------------------------------------

interface OrchestratedTask {
  task: {
    id: string;
    title: string;
    description: string;
    acceptanceCriteria: string[];
    skillCategory: string;
    assignedAgentType: string;
    filePatterns: string[];
    effort: string;
    dependsOn: string[];
    order: number;
  };
  status: string;
  agentType: string;
  retryCount: number;
  completedAt?: string;
}

interface OrchestratedRun {
  id: string;
  delegationId: string;
  delegationTitle: string;
  goal: string;
  status: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  tasks: OrchestratedTask[];
}

function makeOrchestratedRun(
  delegationId: string,
  delegationTitle: string,
  goal: string,
  offsetMs: number
): OrchestratedRun {
  const runId = `run-demo-${Date.now()}`;
  const taskDefs: Array<{
    title: string;
    desc: string;
    skill: string;
    agent: string;
    files: string[];
    effort: string;
    deps: string[];
  }> = [
    {
      title: "Datenbankschema definieren",
      desc: "TypeScript-Typen und Zod-Schema für die Kernentitäten erstellen",
      skill: "data-model",
      agent: "claude-code",
      files: ["src/lib/types/index.ts"],
      effort: "S",
      deps: [],
    },
    {
      title: "API-Route implementieren",
      desc: "POST /api/items mit Zod-Validierung und JSON-Persistenz",
      skill: "api",
      agent: "claude-code",
      files: ["src/app/api/items/route.ts"],
      effort: "M",
      deps: ["Datenbankschema definieren"],
    },
    {
      title: "UI-Komponente bauen",
      desc: "React-Komponente mit Tailwind Dark Theme für die Item-Liste",
      skill: "ui-component",
      agent: "claude-code",
      files: ["src/components/ItemList.tsx"],
      effort: "S",
      deps: ["API-Route implementieren"],
    },
    {
      title: "Vitest-Tests schreiben",
      desc: "Unit-Tests für Schema-Validierung und API-Handler",
      skill: "testing",
      agent: "claude-code",
      files: ["src/lib/types/index.test.ts", "src/app/api/items/route.test.ts"],
      effort: "S",
      deps: ["API-Route implementieren"],
    },
    {
      title: "PR erstellen und Review-Checkliste ausfüllen",
      desc: "Branch pushen, PR öffnen, Checklist abhaken",
      skill: "git",
      agent: "claude-code",
      files: [],
      effort: "XS",
      deps: [
        "UI-Komponente bauen",
        "Vitest-Tests schreiben",
      ],
    },
  ];

  const tasks: OrchestratedTask[] = taskDefs.map((t, i) => ({
    task: {
      id: `${runId}-task-${i}`,
      title: t.title,
      description: t.desc,
      acceptanceCriteria: [
        "TypeScript 0 errors",
        "Tests green",
        "Code reviewed",
      ],
      skillCategory: t.skill,
      assignedAgentType: t.agent,
      filePatterns: t.files,
      effort: t.effort,
      dependsOn: t.deps,
      order: i,
    },
    status: "completed",
    agentType: t.agent,
    retryCount: 0,
    completedAt: nowIso(offsetMs - i * 5 * 60_000),
  }));

  return {
    id: runId,
    delegationId,
    delegationTitle,
    goal,
    status: "completed",
    startedAt: nowIso(offsetMs),
    completedAt: nowIso(offsetMs / 8),
    durationMs: 4 * 60_000,
    tasks,
  };
}

// ---------------------------------------------------------------------------
// Demo Knowledge Cards
// ---------------------------------------------------------------------------

interface KnowledgeCard {
  id: string;
  type: string;
  title: string;
  body: string;
  sourceIds: string[];
  tags: string[];
  privacyClass: string;
  confidence: string;
  createdAt: string;
  updatedAt: string;
}

function makeKnowledgeCard(
  title: string,
  body: string,
  tags: string[],
  offsetMs: number
): KnowledgeCard {
  return {
    id: `card-demo-${randomUUID()}`,
    type: "insight",
    title,
    body,
    sourceIds: [],
    tags,
    privacyClass: "internal",
    confidence: "high",
    createdAt: nowIso(offsetMs),
    updatedAt: nowIso(offsetMs / 2),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  // --- Project Briefs ---
  const briefsFile = "project-briefs.json";
  const existingBriefs: ProjectBrief[] = fileExists(briefsFile)
    ? readJson<ProjectBrief[]>(briefsFile)
    : [];

  const demoTitles = [
    "KI-gestützter Code-Review-Assistent",
    "Automatisierter Release-Notes-Generator",
    "Slack-Integration für ForgePilot Alerts",
  ];
  const hasDemoBriefs = existingBriefs.some((b) =>
    demoTitles.some((t) => b.title.includes(t.split(" ")[0]))
  );

  let brief1Id: string;
  let brief2Id: string;

  if (!hasDemoBriefs) {
    const b1 = makeBrief(
      "KI-gestützter Code-Review-Assistent",
      "Ein Assistent der PRs automatisch reviewed und konstruktives Feedback gibt",
      "Entwickler verlieren täglich Zeit mit manuellen Code-Reviews. Ein KI-Assistent soll PRs analysieren und strukturiertes Feedback nach SOLID-Prinzipien liefern.",
      "Backend- und Full-Stack-Entwickler",
      "approved",
      3 * DAY
    );
    const b2 = makeBrief(
      "Automatisierter Release-Notes-Generator",
      "Release Notes automatisch aus Git-Commits und PRs generieren",
      "Das manuelle Schreiben von Release Notes ist fehleranfällig. KI soll aus Commit-History und PR-Beschreibungen strukturierte Changelogs erzeugen.",
      "DevOps-Teams und Produktmanager",
      "in_review",
      1 * DAY
    );
    const b3 = makeBrief(
      "Slack-Integration für ForgePilot Alerts",
      "ForgePilot Benachrichtigungen direkt in Slack-Channels senden",
      "Delegation-Status-Änderungen und Agent-Run-Ergebnisse sollen in konfigurierbaren Slack-Channels erscheinen.",
      "Entwicklerteams die Slack als primären Kanal nutzen",
      "draft",
      0
    );
    brief1Id = b1.id;
    brief2Id = b2.id;
    existingBriefs.push(b1, b2, b3);
    writeJson(briefsFile, existingBriefs);
    console.log(`  + ${briefsFile}: 3 Demo-Briefs angelegt`);
  } else {
    brief1Id = existingBriefs.find((b) => b.title.includes("Code-Review"))?.id ?? randomUUID();
    brief2Id = existingBriefs.find((b) => b.title.includes("Release"))?.id ?? randomUUID();
    console.log(`  ~ ${briefsFile}: Demo-Briefs bereits vorhanden, übersprungen`);
  }

  // --- Work Items ---
  const itemsFile = "local-items.json";
  const existingItems: WorkItem[] = fileExists(itemsFile)
    ? readJson<WorkItem[]>(itemsFile)
    : [];
  const hasDemoItems = existingItems.some((i) =>
    i.title.includes("PR-Diff analysieren")
  );

  let item1Id: string;
  let item2Id: string;

  if (!hasDemoItems) {
    const i1 = makeWorkItem(
      "PR-Diff analysieren und strukturiertes Feedback generieren",
      brief1Id,
      1,
      "in_progress",
      2 * DAY
    );
    const i2 = makeWorkItem(
      "GitHub Webhook für PR-Events einrichten",
      brief1Id,
      2,
      "todo",
      2 * DAY
    );
    const i3 = makeWorkItem(
      "Commit-Parser für konventionelle Commits implementieren",
      brief2Id,
      1,
      "done",
      4 * DAY
    );
    const i4 = makeWorkItem(
      "Markdown-Template für Release-Notes erstellen",
      brief2Id,
      2,
      "done",
      3 * DAY
    );
    item1Id = i1.id;
    item2Id = i2.id;
    existingItems.push(i1, i2, i3, i4);
    writeJson(itemsFile, existingItems);
    console.log(`  + ${itemsFile}: 4 Demo-Work-Items angelegt`);
  } else {
    item1Id = existingItems.find((i) => i.title.includes("PR-Diff"))?.id ?? randomUUID();
    item2Id = existingItems.find((i) => i.title.includes("GitHub Webhook"))?.id ?? randomUUID();
    console.log(`  ~ ${itemsFile}: Demo-Items bereits vorhanden, übersprungen`);
  }

  // --- Delegations ---
  const delegationsFile = "delegations.json";
  const existingDelegations: Delegation[] = fileExists(delegationsFile)
    ? readJson<Delegation[]>(delegationsFile)
    : [];
  const hasDemoDelegations = existingDelegations.some((d) =>
    d.title.includes("PR-Diff")
  );

  let del1Id: string;

  if (!hasDemoDelegations) {
    const d1 = makeDelegation(
      "PR-Diff analysieren und strukturiertes Feedback generieren",
      item1Id,
      "Analysiere den PR-Diff und erstelle strukturiertes Review-Feedback nach SOLID-Prinzipien",
      "approved",
      "B",
      2 * DAY
    );
    const d2 = makeDelegation(
      "Commit-Parser für konventionelle Commits implementieren",
      item2Id,
      "Implementiere einen Parser für Conventional Commits um Release Notes zu generieren",
      "completed",
      "B",
      5 * DAY
    );
    del1Id = d1.id;
    existingDelegations.push(d1, d2);
    writeJson(delegationsFile, existingDelegations);
    console.log(`  + ${delegationsFile}: 2 Demo-Delegations angelegt`);
  } else {
    del1Id = existingDelegations.find((d) => d.title.includes("PR-Diff"))?.id ?? randomUUID();
    console.log(`  ~ ${delegationsFile}: Demo-Delegations bereits vorhanden, übersprungen`);
  }

  // --- Orchestrated Run ---
  const runsFile = "orchestrated-runs.json";
  interface RunsStore { runs: OrchestratedRun[] }
  const runsStore: RunsStore = fileExists(runsFile)
    ? readJson<RunsStore>(runsFile)
    : { runs: [] };
  const hasDemoRun = runsStore.runs.some((r) => r.id.startsWith("run-demo-"));

  if (!hasDemoRun) {
    const run = makeOrchestratedRun(
      del1Id,
      "Commit-Parser für konventionelle Commits implementieren",
      "Vollständige Implementierung des Conventional-Commits-Parsers mit Tests und PR",
      5 * DAY
    );
    runsStore.runs.push(run);
    writeJson(runsFile, runsStore);
    console.log(`  + ${runsFile}: 1 Demo-Run angelegt (5 Tasks, completed)`);
  } else {
    console.log(`  ~ ${runsFile}: Demo-Run bereits vorhanden, übersprungen`);
  }

  // --- Knowledge Cards ---
  const knowledgeFile = "knowledge-store.json";
  interface KnowledgeStore {
    sources: unknown[];
    items: unknown[];
    cards: KnowledgeCard[];
  }
  const knowledgeStore: KnowledgeStore = fileExists(knowledgeFile)
    ? readJson<KnowledgeStore>(knowledgeFile)
    : { sources: [], items: [], cards: [] };
  const hasDemoCards = knowledgeStore.cards.some((c) =>
    c.title.includes("Conventional Commits")
  );

  if (!hasDemoCards) {
    const c1 = makeKnowledgeCard(
      "Conventional Commits — Best Practices",
      "Conventional Commits ermöglichen automatische Versionierung und Release Notes. Format: `<type>(<scope>): <subject>`. Wichtige Types: feat (minor bump), fix (patch), BREAKING CHANGE (major). Tools: `commitlint`, `semantic-release`, `standard-version`.",
      ["git", "release", "automation"],
      6 * DAY
    );
    const c2 = makeKnowledgeCard(
      "SOLID-Prinzipien im Code-Review",
      "Bei AI-gestützten Code-Reviews sollte besonderes Augenmerk auf Single Responsibility (Funktionen < 20 Zeilen), Open/Closed (Erweiterung ohne Modifikation), und Dependency Inversion (Interfaces statt Implementierungen) gelegt werden.",
      ["code-review", "solid", "best-practices"],
      4 * DAY
    );
    const c3 = makeKnowledgeCard(
      "ForgePilot Agent-Run — Lessons Learned",
      "Agents die PR-Diffs analysieren benötigen als Kontext: (1) vollständigen Diff, (2) Projektkonventionen aus CLAUDE.md, (3) vorherige Review-Kommentare des Teams. Ohne (3) wiederholen Agents bereits bekannte Punkte.",
      ["forgepilot", "agent-run", "knowledge"],
      2 * DAY
    );
    knowledgeStore.cards.push(c1, c2, c3);
    writeJson(knowledgeFile, knowledgeStore);
    console.log(`  + ${knowledgeFile}: 3 Demo-Knowledge-Cards angelegt`);
  } else {
    console.log(`  ~ ${knowledgeFile}: Demo-Cards bereits vorhanden, übersprungen`);
  }

  console.log("\nDemo-Seed abgeschlossen.");
}

main();
