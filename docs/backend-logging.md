# Backend logging

The collector, validator, and worker emit newline-delimited JSON to their existing
console streams. Info events use stdout; warnings and errors use stderr. Logs are
enabled by default with no new configuration or service dependencies.

Each record includes an ISO timestamp, level, and event. Context follows async
calls automatically:

- Run: command, job_id, job_kind.
- Search/provider: search_id, provider, search_params, provider_name.
- Listing: listing_url; successful crawls also include the parsed listing.
- HTTP failures/retries: request_url, attempt, max_attempts, timeout_ms and
  retry_delay_ms when another attempt is scheduled.

Follow listing.started events to see every listing as it is crawled, then
listing.completed or listing.failed for its outcome. page.started records show
search result pages. run.completed includes state, source success/failure counts,
email outcome, and elapsed milliseconds. Validation uses
listing.validation_started and listing.validation_completed.

Errors include error_category and the original error details: name, message,
stack, cause, and additional fields such as HTTP status or database error code.
Plain-object throws retain their fields. Persistence failures include the stage
and affected listing URLs. Lease renewal, scheduling, notification, startup, and
run-finalization failures also emit structured events, including errors that the
application handles and continues past.

For example, a failed listing produces a record shaped like this (shown formatted
for readability; each emitted record occupies one line):

```json
{
  "timestamp": "2026-11-22T12:00:00.000Z",
  "level": "error",
  "event": "listing.failed",
  "command": "worker",
  "job_id": "example-job-id",
  "job_kind": "collect",
  "search_id": "example-search-id",
  "provider": "dfimoveis",
  "provider_name": "DF Imóveis",
  "search_params": { "neighborhoods": ["asa-norte"] },
  "listing_url": "https://www.dfimoveis.com.br/imovel/123",
  "duration_ms": 142,
  "error_category": "parse",
  "error": {
    "name": "Error",
    "message": "parse title missing",
    "stack": "Error: parse title missing\n    at ..."
  }
}
```

With systemd, view the application JSON without journal prefixes:

```sh
journalctl -u house-worker.service -f -o cat
journalctl -u house-validator.service -f -o cat
```

Sensitive credential fields, common credential assignments, authorization values,
and URL credentials are redacted. Request headers, environment variables, email
recipient lists, and raw HTML are not logged. Avoid attaching secrets under
arbitrary field names. Database diagnostic columns continue to store only the
existing error categories; detailed context stays in backend logs.
