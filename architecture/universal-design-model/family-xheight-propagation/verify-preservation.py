from pathlib import Path
import subprocess,hashlib,json
ROOT=Path.cwd();D=Path(__file__).resolve().parent;baseline=json.loads((D/'preservation-baseline.json').read_text());prefix=str(D.relative_to(ROOT))+'/'
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
missing=[p for p in baseline['files'] if not Path(p).exists()]
changed=[p for p,h in baseline['files'].items() if Path(p).exists() and sha(p)!=h]
status=subprocess.check_output(['git','status','--porcelain=v1','-uall']).decode()
outside=lambda text:[line for line in text.splitlines() if not line[3:].startswith(prefix)]
result={'preExistingFiles':len(baseline['files']),'missing':missing,'changed':changed,'outsideStatusIdentical':outside(status)==outside(baseline['status']),'branch':subprocess.check_output(['git','branch','--show-current']).decode().strip(),'head':subprocess.check_output(['git','rev-parse','HEAD']).decode().strip(),'staged':subprocess.check_output(['git','diff','--cached','--name-only']).decode().splitlines(),'trackedModified':subprocess.check_output(['git','diff','--name-only']).decode().splitlines(),'untrackedCount':len(subprocess.check_output(['git','ls-files','--others','--exclude-standard']).decode().splitlines())}
print(json.dumps(result,indent=2))
assert not missing and not changed and result['outsideStatusIdentical'] and result['branch']==baseline['branch'] and result['head']==baseline['head'] and not result['staged']
