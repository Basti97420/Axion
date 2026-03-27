import json
import os
import subprocess
import tempfile
from datetime import datetime

from app import db


def _get_script_token():
    """Liest oder generiert den internen Script-Token."""
    from app.services.settings_env import read as env_read, write as env_write
    import secrets
    token = env_read('PYTHON_SCRIPT_TOKEN', '')
    if not token:
        token = secrets.token_hex(32)
        env_write('PYTHON_SCRIPT_TOKEN', token)
    return token


def _write_axion_helper(tmpdir, token, project_id, instance_path):
    """Schreibt axion.py in das tmp-Verzeichnis."""
    from app.services.axion_helper_template import TEMPLATE
    content = TEMPLATE.format(
        BASE_URL='http://127.0.0.1:5050',
        SCRIPT_TOKEN=token,
        PROJECT_ID=project_id,
    )
    with open(os.path.join(tmpdir, 'axion.py'), 'w', encoding='utf-8') as f:
        f.write(content)


_SUPPRESS_STDOUT = """
import sys as __sys__, io as __io__
__old_stdout__ = __sys__.stdout
__sys__.stdout = __io__.StringIO()
"""

_RESTORE_STDOUT = """
__sys__.stdout = __old_stdout__
"""

_SNAP_BEFORE = """
import json as __js__, sys as __ss__, types as __ts__
__snap__ = {}
for __k__, __v__ in list(globals().items()):
    if __k__.startswith('__'): continue
    if isinstance(__v__, __ts__.ModuleType): continue
    try: __snap__[__k__] = repr(__v__)
    except Exception: pass
"""

_DUMP_DIFF = """
import json as __js__, sys as __ss__, types as __ts__
def __dump__():
    __d__ = {}
    for __k__, __v__ in list(globals().items()):
        if __k__.startswith('__'): continue
        if isinstance(__v__, __ts__.ModuleType): continue
        try:
            __r__ = repr(__v__)
            if __k__ not in __snap__ or __snap__[__k__] != __r__:
                __d__[__k__] = {'type': type(__v__).__name__, 'repr': __r__[:500]}
        except Exception: pass
    print('__AXION_VARS__:' + __js__.dumps(__d__, ensure_ascii=False), file=__ss__.stderr)
__dump__()
"""

_DUMP_ALL = """
import json as __js__, sys as __ss__, types as __ts__
def __dump__():
    __d__ = {}
    for __k__, __v__ in list(globals().items()):
        if __k__.startswith('__'): continue
        if isinstance(__v__, __ts__.ModuleType): continue
        try:
            __d__[__k__] = {'type': type(__v__).__name__, 'repr': repr(__v__)[:500]}
        except Exception: pass
    print('__AXION_VARS__:' + __js__.dumps(__d__, ensure_ascii=False), file=__ss__.stderr)
__dump__()
"""


def build_cell_code(cells, cell_index):
    """Baut ausführbaren Code mit Snapshot/Diff-Injektion für Zellen-Run."""
    if cell_index == 0:
        return (cells[0] or '') + _DUMP_ALL
    else:
        before = '\n\n'.join(cells[:cell_index])
        return (
            _SUPPRESS_STDOUT +
            before +
            _RESTORE_STDOUT +
            _SNAP_BEFORE +
            '\n\n' +
            (cells[cell_index] or '') +
            _DUMP_DIFF
        )


def run_script(app, script_id, run_id):
    """Führt ein Python-Script in einem eigenen App-Context aus."""
    with app.app_context():
        _run_inner(script_id, run_id)


def run_script_with_code(app, script_id, run_id, code, inject_vars=False):
    """Führt einen bestimmten Code-String für ein Script aus (z.B. für Zellen-Run)."""
    with app.app_context():
        _run_inner(script_id, run_id, code_override=code, inject_vars=inject_vars)


def _run_inner(script_id, run_id, code_override=None, inject_vars=False):
    from flask import current_app
    from app.models.python_script import PythonScript, PythonScriptRun

    script = PythonScript.query.get(script_id)
    run    = PythonScriptRun.query.get(run_id)
    if not script or not run:
        return

    instance_path = current_app.instance_path

    # Per-Script-Workspace
    from slugify import slugify
    slug = slugify(script.name or 'script', max_length=40)
    workspace_dir = os.path.join(instance_path, 'python-scripts',
                                 str(script.project_id), f"{script.id}-{slug}")
    os.makedirs(workspace_dir, exist_ok=True)

    # Code bestimmen: Override > cells > code
    if code_override is not None:
        code = code_override
    elif script.cells:
        code = '\n\n'.join(json.loads(script.cells))
    else:
        code = script.code

    try:
        token = _get_script_token()

        with tempfile.TemporaryDirectory() as tmpdir:
            _write_axion_helper(tmpdir, token, script.project_id, instance_path)

            script_path = os.path.join(tmpdir, 'script.py')
            with open(script_path, 'w', encoding='utf-8') as f:
                f.write(code)

            env = {
                **os.environ,
                'AXION_PROJECT_ID':       str(script.project_id),
                'AXION_INSTANCE_PATH':    instance_path,
                'AXION_SCRIPT_WORKSPACE': workspace_dir,
                'PYTHONPATH':             tmpdir,
                'PYTHONUNBUFFERED':       '1',
            }

            result = subprocess.run(
                ['python3', script_path],
                capture_output=True,
                text=True,
                timeout=script.timeout_sec,
                env=env,
                cwd=workspace_dir,
            )

        stdout = result.stdout
        stderr = result.stderr

        if inject_vars:
            import re
            m = re.search(r'^__AXION_VARS__:(.+)$', stderr or '', re.MULTILINE)
            if m:
                run.variables = m.group(1)
                stderr = (stderr or '').replace(m.group(0), '').strip()

        run.stdout    = stdout[:50000]
        run.stderr    = stderr[:10000]
        run.exit_code = result.returncode

    except subprocess.TimeoutExpired:
        run.error     = f'Timeout nach {script.timeout_sec}s überschritten'
        run.exit_code = -1
    except Exception as e:
        run.error     = str(e)[:500]
        run.exit_code = -2
    finally:
        run.finished_at = datetime.utcnow()
        # Laufzeiten aktualisieren
        from datetime import timedelta
        script_obj = PythonScript.query.get(script_id)
        if script_obj:
            script_obj.last_run_at = datetime.utcnow()
            if script_obj.schedule_type == 'interval':
                script_obj.next_run_at = datetime.utcnow() + timedelta(minutes=script_obj.interval_min)
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
