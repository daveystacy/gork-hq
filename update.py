#!/usr/bin/env python3
"""GORK HQ status CLI.
  update.py agent builder working "Task title" 40
  update.py task add "Title" builder [queued|in-progress|done]
  update.py task set t2 done
  update.py log "message"
Env STATUS=path (default ./status.json next to this script)."""
import json,sys,os,datetime
P=os.environ.get("STATUS",os.path.join(os.path.dirname(os.path.abspath(__file__)),"status.json"))
now=datetime.datetime.now().astimezone().isoformat(timespec="seconds")
d=json.load(open(P)); a=sys.argv[1:]
def log(m): d["log"].append({"t":now,"msg":m}); d["log"]=d["log"][-100:]
if not a: print(__doc__); sys.exit(1)
if a[0]=="agent":
    ag=next(x for x in d["agents"] if x["id"]==a[1]); st=a[2]
    if st not in("idle","working","meeting","waiting_user"): sys.exit("bad state")
    if ag["state"]!=st: ag["since"]=now
    ag["state"]=st; ag["task"]=a[3] if len(a)>3 else ("" if st=="idle" else ag["task"])
    ag["progress"]=int(a[4]) if len(a)>4 else (0 if st=="idle" else ag["progress"])
    log(f'{ag["name"]} → {st}'+(f': {ag["task"]}' if ag["task"] else ""))
elif a[0]=="task" and a[1]=="add":
    s=a[4] if len(a)>4 else "queued"; tid="t%d"%(len(d["tasks"])+1)
    d["tasks"].append({"id":tid,"title":a[2],"owner":a[3],"status":s,"started":now if s!="queued" else None,"finished":now if s=="done" else None}); log(f'Task {tid} added: {a[2]}'); print(tid)
elif a[0]=="task" and a[1]=="set":
    t=next(x for x in d["tasks"] if x["id"]==a[2]); t["status"]=a[3]
    if a[3]=="in-progress": t["started"]=t["started"] or now
    if a[3]=="done": t["finished"]=now
    log(f'Task "{t["title"]}" → {a[3]}')
elif a[0]=="log": log(" ".join(a[1:]))
else: print(__doc__); sys.exit(1)
d["updated"]=now; json.dump(d,open(P,"w"),indent=1)
# publish: commit+push status.json if inside a git repo (GitHub Pages redeploys ~1 min)
import subprocess
R=os.path.dirname(os.path.abspath(P))
if os.environ.get("NOPUSH")!="1" and os.path.isdir(os.path.join(R,".git")):
    q=dict(cwd=R,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    subprocess.run(["git","add","status.json"],**q)
    if subprocess.run(["git","commit","-qm","status: "+d["log"][-1]["msg"][:60]],**q).returncode==0:
        subprocess.Popen(["git","push","-q"],**q)
