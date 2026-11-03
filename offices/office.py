#!/usr/bin/env python3
"""Report to an Expire office from anything that isn't a Claude chat (a script, a bot, another AI).

  OFFICE_TOKEN=... office.py report gamey world working "Blocking out the dorms" 35
  OFFICE_TOKEN=... office.py report gamey gamey waiting_user "Which layout?"
  OFFICE_TOKEN=... office.py report gamey world idle
  OFFICE_TOKEN=... office.py task-add gamey "Block out the dorms" world in-progress    # prints the task id
  OFFICE_TOKEN=... office.py task-set 12 done "Merged PR #91"
  OFFICE_TOKEN=... office.py log gamey "Preview is up" world deploy
  OFFICE_TOKEN=... office.py focus gamey "ECA dorms, first floor"

The token also works from ~/.config/expire-offices/token. Never put it in this repo: the repo is public.
"""
import json
import os
import sys
import urllib.request

SB = "https://szpczmrvthxkdaxqzlqk.supabase.co"
PK = "sb_publishable_yEG-pRaQg9BZg4DM9ibxCg_JLuX0hLy"


def token():
    t = os.environ.get("OFFICE_TOKEN")
    path = os.path.expanduser("~/.config/expire-offices/token")
    if not t and os.path.exists(path):
        t = open(path).read().strip()
    if not t:
        sys.exit("No token: set OFFICE_TOKEN or write ~/.config/expire-offices/token")
    return t


def call(action, args):
    body = json.dumps({"p_token": token(), "p_action": action, "p_args": args}).encode()
    req = urllib.request.Request(f"{SB}/rest/v1/rpc/office_api", body, {"apikey": PK, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.load(r)


def arg(a, i):
    return a[i] if len(a) > i else None


def main(a):
    if not a:
        print(__doc__)
        return 1
    cmd = a[0]
    if cmd == "report":
        p = arg(a, 5)
        call("report", {"office": a[1], "agent": a[2], "state": a[3], "task": arg(a, 4), "progress": int(p) if p else None, "msg": arg(a, 6)})
    elif cmd == "task-add":
        print(call("task_add", {"office": a[1], "title": a[2], "owner": arg(a, 3), "status": arg(a, 4) or "queued"})["id"])
    elif cmd == "task-set":
        call("task_set", {"id": int(a[1]), "status": a[2], "note": arg(a, 3)})
    elif cmd == "log":
        call("log", {"office": a[1], "msg": a[2], "agent": arg(a, 3), "kind": arg(a, 4) or "note"})
    elif cmd == "focus":
        call("focus", {"office": a[1], "focus": a[2]})
    else:
        print(__doc__)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
