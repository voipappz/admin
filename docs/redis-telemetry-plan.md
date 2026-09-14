# Redis telemetry alongside external InfluxDB

Status: proposed implementation plan. No backend migration has been implemented.

## Objective

Keep InfluxDB on an external server for existing historical metrics, searchable
logs, and queries. Add independently configurable Redis Time Series and Redis
Streams support alongside it. Preserve current behavior by default.

## Intended architecture

- Ruby publishes numeric metrics to Redis Time Series through background adapters.
- Ruby publishes structured, redacted logs/events to Redis Streams through background adapters.
- Existing Ruby delivery through Telegraf to external InfluxDB remains available.
- Crystal and Connectix have separate writers and require their own integrations.
- Use a separate telemetry Redis instance from operational Redis, which serves
  Sidekiq, sessions, locks, campaign queues, and call state.
- InfluxDB output remains enabled by default; new Redis outputs start disabled.

Request/call handlers enqueue records into bounded local buffers. Background
workers perform destination I/O. Each destination must have independent delivery,
timeouts, and failure accounting so one outage does not block the others.

Redis Streams is initially an additional destination, not the transport in front
of InfluxDB. A Streams-to-InfluxDB exporter is a separate future feature.

## Storage responsibilities

| Data | Existing path | Additional Redis support |
| --- | --- | --- |
| Numeric metrics | External InfluxDB | Time Series |
| Structured logs/events | Existing applicable pipeline; searchable logs in InfluxDB | Streams |
| Complete CDR records | Existing storage and query paths | No automatic Time Series conversion |
| Historical queries and log search | External InfluxDB | Not replaced by Streams |
| Jobs, sessions, locks, current operational state | Operational Redis | Unchanged by this plan |

Time Series stores numeric samples. Streams stores event records but does not
automatically provide the full-text search needed by the Logs screen. External
InfluxDB outages may interrupt historical queries/log search even while local
Redis metrics remain available.

## 1. Establish the data contract

Inventory producers and readers in `../voipappz-api`, `../va-crystal`,
`../app/connectix`, and Nimbus Admin. Confirm actual runtime paths rather than
relying on old comments.

Define metric names, units, numeric fields, tenant labels, timestamp precision,
event identities, and aggregation semantics. Separate measurements from text logs
and complete CDR records. Preserve existing endpoint response contracts.

## 2. Configure infrastructure and destinations

The inspected API Compose configuration uses `redis:7-alpine` without a Time
Series module configured. Provision and pin a telemetry Redis distribution/version
that supports Time Series; verify required commands in CI.

Configure external InfluxDB address, database, credentials, TLS verification,
timeouts, and retries through environment-managed settings. Configure telemetry
Redis independently, including authentication/TLS where applicable.

Provide separate output enable flags, retention and downsampling settings,
buffer/backlog limits, and overflow policies. Final setting names should follow
each repository's configuration conventions.

Persistence, backup/recovery expectations, acceptable loss, retention windows,
and expected outage duration must be specified before production rollout. A
mounted volume alone does not establish a delivery guarantee.

## 3. Introduce destination adapters

Start behind Ruby's existing `MetricPublisher`. Normalize and redact records
before fan-out. Provide injectable adapters for InfluxDB's existing delivery path,
Redis Time Series, and Redis Streams.

Use bounded asynchronous delivery per destination. Record accepted, delivered,
failed, retried, and dropped records as appropriate. Avoid recursive logging when
the telemetry pipeline fails. Local in-memory buffering is not durable: document
what can be lost on process termination or overflow.

## 4. Implement Time Series writes

First support `live_state`: active calls, registrations, and extension counts.
Define stable keys, tenant labels, duplicate policy, raw retention, downsampling,
and handling of missing/late samples. Preserve current per-environment aggregation
semantics. Reject or explicitly exclude nonnumeric fields.

Measure series count, memory, and throughput before expanding to other metrics.

## 5. Implement Streams writes

Start with structured Ruby logs. Preserve event identity, original timestamps,
severity, tenant scope, correlation fields, and redacted payloads.

Define partitioning, retention, maximum backlog, overflow behavior, and persistence.
If consumer groups are introduced, specify acknowledgement, retry, pending-entry
recovery, and trimming interactions. Do not imply global ordering across separate
streams or producers.

Keep searchable log reads on external InfluxDB. Do not silently route business
events through a best-effort diagnostic logging path.

## 6. Add configurable numeric metric reads

Keep InfluxDB as the default reader. Implement a Redis reader for a documented
subset of existing numeric metric queries while preserving API response shapes.

Enforce tenant scope server-side. Unsupported queries must be explicit; do not
silently substitute partial results or switch backends. Leave historical queries,
text search, and full-record queries on their existing paths.

## 7. Extend other producers

After Ruby behavior is verified, implement the same telemetry contract in Crystal
and Connectix while preserving their bounded, asynchronous write behavior.
Connectix is a separate product; share contracts rather than introduce runtime
dependencies between it and the canonical VoipAppz backend.

## 8. Automated verification

Use deterministic fixtures and injectable adapters for unit tests. Run integration
tests in CI against disposable Redis and InfluxDB containers, never production.

| Area | Required proof |
| --- | --- |
| Defaults | Existing InfluxDB behavior is unchanged |
| Routing | Only enabled destinations receive the intended records |
| Time Series | Values, labels, timestamps, duplicates, retention, and aggregation are correct |
| Streams | Payloads, IDs, ordering within a stream, and trimming match the contract |
| Security | Redaction precedes fan-out; cross-tenant reads are rejected |
| Failure isolation | Either destination can fail without blocking the other or requests |
| Backpressure | Buffers remain bounded; overflow is observable and follows policy |
| Read parity | Both readers match independently calculated expected results |
| External connectivity | TLS/auth failures, timeouts, outages, and reconnection are handled |
| Recovery | Configured persistence/restart behavior matches stated loss guarantees |
| Rollback | Disabling Redis restores existing functionality |

Fixtures must include multiple tenants, missing intervals, duplicate timestamps,
late arrivals, and counter/gauge distinctions. Do not rely solely on agreement
between two backends as proof of correctness.

If an exporter is added later, test crashes before writing and after successful
writing but before acknowledgement, retries, replay, and destination outage
recovery. Resolve duplicate ingestion before enabling export alongside direct
InfluxDB delivery.

Backend features and tests ship together. Follow each repository's verification
policy. Nimbus Admin's only permitted local verification is `npm run lint`;
builds and tests run in CI.

## Rollout and acceptance

1. Deliver Ruby adapters, optional `live_state` Time Series writes, optional log
   Streams writes, deployment settings, and CI coverage.
2. Enable dual output in a test environment with existing InfluxDB reads unchanged.
3. Measure memory, series count, latency, backlog, and outage behavior.
4. Validate and selectively enable Redis metric reads.
5. Extend verified behavior to Crystal and Connectix.
6. Roll out with configuration-based rollback and explicit operational limits.

Complete when external InfluxDB remains functional, Redis capabilities can be
enabled independently, endpoint contracts remain consistent, secrets are redacted,
failures are bounded and observable, and supported behavior is reproducible in CI.

## Main risks and outstanding decisions

- Retention and high series counts can make telemetry Redis memory-intensive.
- Shared operational/telemetry Redis would increase contention and outage impact.
- Numeric query semantics can drift, producing plausible but incorrect charts.
- Streams retention can discard unexported records unless policy accounts for it.
- Historical log search remains dependent on external InfluxDB availability.
- Final capacity and loss guarantees require ingestion measurements and recovery
  requirements; the code scan alone does not establish a cost/performance benefit.
- No existing historical data migration, Redis-only full platform operation, or
  removal of InfluxDB is authorized by this additive plan.
