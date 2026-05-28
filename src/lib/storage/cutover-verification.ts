export interface JsonDelegationSnapshot {
  id: string
  title?: string
  status?: string
}

export interface PostgresDelegationSnapshot {
  id: string
  title: string
  status: string
}

export interface JsonProjectBriefSnapshot {
  id: string
  title?: string
  status?: string
}

export interface PostgresProjectBriefSnapshot {
  id: string
  title: string
  status: string
}

export interface StoreComparison {
  jsonCount: number
  postgresCount: number
  missingInPostgres: string[]
  missingInJson: string[]
  mismatched: Array<{
    id: string
    field: 'title' | 'status'
    jsonValue: string | undefined
    postgresValue: string
  }>
  readyForPostgresPrimary: boolean
}

export interface StoreComparisonOptions {
  /**
   * Postgres may legitimately contain rows created after the last JSON export
   * or historical rows already migrated from another environment.
   */
  allowPostgresSuperset?: boolean
}

function byId<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]))
}

export function compareDelegationStores(
  jsonDelegations: JsonDelegationSnapshot[],
  postgresDelegations: PostgresDelegationSnapshot[],
  options: StoreComparisonOptions = {},
): StoreComparison {
  return compareStores(jsonDelegations, postgresDelegations, options)
}

export function compareProjectBriefStores(
  jsonProjectBriefs: JsonProjectBriefSnapshot[],
  postgresProjectBriefs: PostgresProjectBriefSnapshot[],
  options: StoreComparisonOptions = {},
): StoreComparison {
  return compareStores(jsonProjectBriefs, postgresProjectBriefs, options)
}

function compareStores(
  jsonItems: JsonDelegationSnapshot[] | JsonProjectBriefSnapshot[],
  postgresItems: PostgresDelegationSnapshot[] | PostgresProjectBriefSnapshot[],
  options: StoreComparisonOptions,
): StoreComparison {
  const allowPostgresSuperset = options.allowPostgresSuperset ?? true
  const jsonById = byId(jsonItems)
  const postgresById = byId(postgresItems)

  const missingInPostgres = jsonItems
    .filter((delegation) => !postgresById.has(delegation.id))
    .map((delegation) => delegation.id)
    .sort()

  const missingInJson = postgresItems
    .filter((delegation) => !jsonById.has(delegation.id))
    .map((delegation) => delegation.id)
    .sort()

  const mismatched: StoreComparison['mismatched'] = []
  for (const jsonDelegation of jsonItems) {
    const postgresDelegation = postgresById.get(jsonDelegation.id)
    if (!postgresDelegation) continue

    if (jsonDelegation.title !== postgresDelegation.title) {
      mismatched.push({
        id: jsonDelegation.id,
        field: 'title',
        jsonValue: jsonDelegation.title,
        postgresValue: postgresDelegation.title,
      })
    }
    if (jsonDelegation.status !== postgresDelegation.status) {
      mismatched.push({
        id: jsonDelegation.id,
        field: 'status',
        jsonValue: jsonDelegation.status,
        postgresValue: postgresDelegation.status,
      })
    }
  }

  return {
    jsonCount: jsonItems.length,
    postgresCount: postgresItems.length,
    missingInPostgres,
    missingInJson,
    mismatched,
    readyForPostgresPrimary:
      missingInPostgres.length === 0 &&
      (allowPostgresSuperset || missingInJson.length === 0) &&
      mismatched.length === 0,
  }
}
