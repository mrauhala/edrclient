# Which preview channels to delete so that at most $keep stay, this pull request's ($own, e.g. "pr177") among them.
# Reads `firebase hosting:channel:list --json` and prints one channel id per line, least recently deployed first.
# Only the channels the preview workflow makes count, named pr<number>-<branch>: the live channel and any channel made
# by hand are left alone.
def deployed: (.release.releaseTime // .updateTime // .createTime // "1970-01-01T00:00:00Z") | sub("\\.[0-9]+"; "") | fromdateiso8601;
def mine($id): $id | test("^" + $own + "(-|$)");

[ .result.channels[]
  | { id: (.name | split("/") | last), at: deployed }
  | select(.id | test("^pr[0-9]+(-|$)"))
  | select(mine(.id) | not) ]
| sort_by(.at) | reverse
| .[($keep - 1):]
| reverse
| .[].id
