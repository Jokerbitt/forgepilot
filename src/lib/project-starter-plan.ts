import type { MilestoneGenerationResult } from '@/lib/models/milestone'
import type { ProjectBrief } from '@/lib/models/project-brief'
import { persistenceLabel, platformLabel } from '@/lib/project-planning-recommendations'

function includesAny(text: string, needles: string[]): boolean {
  const lower = text.toLowerCase()
  return needles.some(needle => lower.includes(needle))
}

function projectKind(brief: ProjectBrief): 'todo' | 'generic' {
  const source = `${brief.title} ${brief.rawIdea} ${brief.problemStatement} ${brief.desiredOutcome}`
  if (includesAny(source, ['todo', 'to-do', 'aufgabe', 'aufgaben', 'planner', 'planer'])) return 'todo'
  return 'generic'
}

export function buildStarterPlan(brief: ProjectBrief): MilestoneGenerationResult {
  const platform = platformLabel(brief.targetPlatform ?? 'webapp')
  const persistence = persistenceLabel(brief.persistenceStrategy ?? 'postgres')
  const kind = projectKind(brief)
  const productName = brief.title || 'MVP'

  if (kind === 'todo') {
    return {
      milestones: [
        {
          title: 'M1 - Nutzbarer Todo-MVP',
          description: `Ein erster ${platform}-MVP, der Aufgaben sichtbar und bedienbar macht.`,
          goal: 'Der Nutzer kann Aufgaben erfassen, sehen, priorisieren und den Status nachvollziehen.',
          targetWeek: 1,
          status: 'planned',
        },
        {
          title: 'M2 - Persistenz und Workflow',
          description: `Aufgaben werden mit ${persistence} dauerhaft gespeichert und bleiben nach Reload erhalten.`,
          goal: 'Der Todo-Workflow ist alltagstauglich: erstellen, bearbeiten, abschliessen, filtern.',
          targetWeek: 2,
          status: 'planned',
        },
        {
          title: 'M3 - Qualitaet und Launch-Test',
          description: 'UI-Polish, Fehlerzustaende und ein realistischer End-to-End-Test.',
          goal: 'Die App fuehlt sich sauber, verstaendlich und testbar an.',
          targetWeek: 3,
          status: 'planned',
        },
      ],
      workPackages: [
        {
          milestoneIndex: 0,
          title: 'Todo-MVP Grundgeruest bauen',
          description: `Erstelle die erste nutzbare Oberflaeche fuer "${productName}" mit Aufgabenliste, Eingabefeld, Prioritaet, Status und leerem Zustand.`,
          definitionOfDone: [
            'Eine Todo-Seite ist erreichbar und visuell professionell aufgebaut.',
            'Neue Aufgaben koennen mit Titel, Prioritaet und Status im UI angelegt werden.',
            'Leerer Zustand, Beispielzustand und aktive Aufgaben sind klar unterscheidbar.',
            'Die Umsetzung bleibt bewusst klein und testbar.',
          ],
          riskClass: 'A',
          priority: 'critical',
          estimatedHours: 4,
          dependsOn: [],
          status: 'ready',
          tags: ['frontend', 'mvp', 'todo'],
        },
        {
          milestoneIndex: 0,
          title: 'Todo-Interaktionen verfeinern',
          description: 'Statuswechsel, Prioritaetsanzeige und schnelle Filter fuer offene/erledigte Aufgaben ergaenzen.',
          definitionOfDone: [
            'Aufgaben koennen als offen, in Arbeit oder erledigt markiert werden.',
            'Filter fuer alle, offen und erledigt sind vorhanden.',
            'Die wichtigsten Aktionen sind ohne Erklaertext erkennbar.',
          ],
          riskClass: 'A',
          priority: 'high',
          estimatedHours: 3,
          dependsOn: ['Todo-MVP Grundgeruest bauen'],
          status: 'backlog',
          tags: ['frontend', 'ux'],
        },
        {
          milestoneIndex: 1,
          title: 'Persistenz fuer Aufgaben anbinden',
          description: `Speichere Aufgaben dauerhaft mit ${persistence} oder einem klar gekapselten Repository-Fallback fuer lokale Tests.`,
          definitionOfDone: [
            'Aufgaben bleiben nach Reload erhalten.',
            'Datenzugriff liegt hinter einer kleinen Repository-Schicht.',
            'Fehler beim Speichern werden sichtbar und verstaendlich gemeldet.',
          ],
          riskClass: 'B',
          priority: 'high',
          estimatedHours: 6,
          dependsOn: ['Todo-MVP Grundgeruest bauen'],
          status: 'backlog',
          tags: ['backend', 'persistence'],
        },
        {
          milestoneIndex: 1,
          title: 'Todo-API und Validierung absichern',
          description: 'Eingaben validieren, einfache API-Fehler behandeln und Testdaten stabil halten.',
          definitionOfDone: [
            'Titel und Prioritaet werden serverseitig validiert.',
            'API-Antworten liefern klare Fehlertexte.',
            'Mindestens ein automatisierter Test deckt den Happy Path ab.',
          ],
          riskClass: 'B',
          priority: 'medium',
          estimatedHours: 5,
          dependsOn: ['Persistenz fuer Aufgaben anbinden'],
          status: 'backlog',
          tags: ['api', 'validation', 'test'],
        },
        {
          milestoneIndex: 2,
          title: 'Produktiven Testlauf dokumentieren',
          description: 'Den kompletten Testablauf Idee -> Plan -> Delegation -> Ergebnis -> Review dokumentieren.',
          definitionOfDone: [
            'Ein manueller Testpfad ist in der UI oder Dokumentation nachvollziehbar.',
            'Bekannte Grenzen und naechste Schritte sind dokumentiert.',
            'Die App kann als Demo-Projekt fuer ForgePilot genutzt werden.',
          ],
          riskClass: 'A',
          priority: 'medium',
          estimatedHours: 2,
          dependsOn: ['Todo-MVP Grundgeruest bauen'],
          status: 'backlog',
          tags: ['docs', 'qa'],
        },
      ],
    }
  }

  return {
    milestones: [
      {
        title: 'M1 - MVP-Kern nutzbar machen',
        description: `Der erste ${platform}-MVP bildet den Hauptnutzen ab.`,
        goal: 'Ein Nutzer kann den zentralen Workflow einmal erfolgreich durchlaufen.',
        targetWeek: 1,
        status: 'planned',
      },
      {
        title: 'M2 - Daten und Stabilitaet',
        description: `Persistenz, Fehlerzustaende und robuste Bedienung mit ${persistence}.`,
        goal: 'Der MVP arbeitet verlaesslich mit echten Daten.',
        targetWeek: 2,
        status: 'planned',
      },
      {
        title: 'M3 - Review und Launch-Test',
        description: 'Qualitaet, Polishing und ein belegbarer Testlauf.',
        goal: 'Das Projekt ist bereit fuer einen realistischen Nutzertest.',
        targetWeek: 3,
        status: 'planned',
      },
    ],
    workPackages: [
      {
        milestoneIndex: 0,
        title: 'MVP-Hauptscreen bauen',
        description: `Baue den wichtigsten Screen fuer "${productName}" mit klarem Hauptworkflow und professioneller UI.`,
        definitionOfDone: [
          'Der Hauptscreen ist erreichbar und zeigt den Kernnutzen.',
          'Der wichtigste Nutzerfluss ist als UI-Prototyp bedienbar.',
          'Leere, normale und einfache Fehlerzustaende sind sichtbar.',
        ],
        riskClass: 'A',
        priority: 'critical',
        estimatedHours: 4,
        dependsOn: [],
        status: 'ready',
        tags: ['frontend', 'mvp'],
      },
      {
        milestoneIndex: 1,
        title: 'Datenmodell und Persistenz anbinden',
        description: `Lege ein kleines Datenmodell an und speichere die wichtigsten Objekte mit ${persistence}.`,
        definitionOfDone: [
          'Das Datenmodell ist klein und nachvollziehbar.',
          'CRUD fuer den Kernnutzen ist vorbereitet oder umgesetzt.',
          'Fehler beim Speichern sind sichtbar.',
        ],
        riskClass: 'B',
        priority: 'high',
        estimatedHours: 6,
        dependsOn: ['MVP-Hauptscreen bauen'],
        status: 'backlog',
        tags: ['backend', 'persistence'],
      },
      {
        milestoneIndex: 2,
        title: 'MVP-Testlauf und Review vorbereiten',
        description: 'Einen realistischen Testfall, Review-Kriterien und naechste Schritte festhalten.',
        definitionOfDone: [
          'Ein Ende-zu-Ende-Testpfad ist beschrieben.',
          'Die wichtigsten Risiken sind dokumentiert.',
          'Der naechste sinnvolle Ausbau ist klar.',
        ],
        riskClass: 'A',
        priority: 'medium',
        estimatedHours: 2,
        dependsOn: ['MVP-Hauptscreen bauen'],
        status: 'backlog',
        tags: ['qa', 'docs'],
      },
    ],
  }
}
