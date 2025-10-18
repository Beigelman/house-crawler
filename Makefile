cron-logs:
	journalctl -u house-crawler.service -f

cron-logs-last:
	journalctl -u house-crawler.service -n 50 -r

run:
	deno task run