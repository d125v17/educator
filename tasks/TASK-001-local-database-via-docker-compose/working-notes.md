# Working Notes: Local database running via Docker Compose

Temporary working notes for this task. Notes here are raw observations and
must not be treated as approved decisions. Anything unverified must be
explicitly labeled as an unverified assumption.

## Findings

None yet.

## Hypotheses

- (Unverified assumption, to be confirmed) A single database service defined
  in a Docker Compose file will be sufficient for the local development need.
- (Unverified assumption, to be confirmed) The backend application in a later
  task will connect over the host machine's exposed port.

## Decisions needed

- Database technology and version.
- Local port mapping.
- How local credentials are supplied without committing secrets.
- Data persistence approach and whether the data location is ignored by
  version control.
- Whether a database administration/UI tool is in scope.

## Experiments

None yet.

## Useful references

None yet.

## Knowledge to preserve

Anything reusable discovered here (for example a validated Compose pattern or
a documented verification command) should be promoted into `docs/`, and any
durable architectural decision into `docs/decisions/`, once confirmed.
