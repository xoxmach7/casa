# Dedicated backup service — deliberately NOT part of the backend image.
# Uses the official Postgres image so pg_dump always matches the server's
# major version exactly, with zero risk to the actual app container.
FROM postgres:18-alpine

COPY backup.sh /backup.sh
RUN chmod +x /backup.sh

CMD ["/backup.sh"]
