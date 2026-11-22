cron-logs:
	journalctl -u house-worker.service -f

cron-logs-last:
	journalctl -u house-worker.service -n 50 -r

validator-logs:
	journalctl -u house-validator.service -f

validator-logs-last:
	journalctl -u house-validator.service -n 50 -r

run:
	deno task run

validate:
	deno task validate
