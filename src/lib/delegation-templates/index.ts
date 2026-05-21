import type { TaskContract } from '@/lib/models/delegation'

export interface DelegationTemplate {
  id: string
  name: string
  description: string
  icon: string
  defaultContract: Partial<Omit<TaskContract, 'goal'>> & {
    goalTemplate: string
    acceptanceCriteria: string[]
  }
}

export const DELEGATION_TEMPLATES: DelegationTemplate[] = [
  {
    id: 'bug-fix',
    name: 'Bug Fix',
    description: 'Investigate and fix a specific bug with root cause analysis',
    icon: '🐛',
    defaultContract: {
      riskClass: 'B',
      goalTemplate: 'Fix bug: [DESCRIBE THE BUG HERE]',
      acceptanceCriteria: [
        'Root cause identified and documented',
        'Bug is fixed and no longer reproducible',
        'Existing tests still pass',
        'New regression test added',
      ],
    },
  },
  {
    id: 'new-feature',
    name: 'New Feature',
    description: 'Implement a new feature with tests and documentation',
    icon: '✨',
    defaultContract: {
      riskClass: 'B',
      goalTemplate: 'Implement: [DESCRIBE THE FEATURE HERE]',
      acceptanceCriteria: [
        'Feature works as described',
        'Unit tests cover the happy path',
        'Edge cases handled gracefully',
        'TypeScript types are correct',
      ],
    },
  },
  {
    id: 'refactoring',
    name: 'Refactoring',
    description: 'Improve code structure without changing behavior',
    icon: '🔧',
    defaultContract: {
      riskClass: 'A',
      goalTemplate: 'Refactor: [DESCRIBE WHAT TO REFACTOR AND WHY]',
      acceptanceCriteria: [
        'All existing tests still pass',
        'No behavior changes',
        'Code is cleaner and better structured',
        'TypeScript strict mode satisfied',
      ],
    },
  },
  {
    id: 'test-coverage',
    name: 'Test Coverage',
    description: 'Add missing tests for existing functionality',
    icon: '🧪',
    defaultContract: {
      riskClass: 'A',
      goalTemplate: 'Add tests for: [DESCRIBE WHAT TO TEST]',
      acceptanceCriteria: [
        'Tests cover the described functionality',
        'Both happy path and error cases tested',
        'Tests are readable and well-named',
        'No production code changed',
      ],
    },
  },
  {
    id: 'documentation',
    name: 'Documentation',
    description: 'Write or improve technical documentation',
    icon: '📚',
    defaultContract: {
      riskClass: 'A',
      goalTemplate: 'Document: [DESCRIBE WHAT TO DOCUMENT]',
      acceptanceCriteria: [
        'Documentation is accurate and up-to-date',
        'Examples are included where helpful',
        'Markdown formatting is clean',
      ],
    },
  },
]

export function getTemplate(id: string): DelegationTemplate | undefined {
  return DELEGATION_TEMPLATES.find(t => t.id === id)
}
