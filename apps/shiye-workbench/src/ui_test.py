"""Run both modes in the actual native WebView2 window, using isolated data."""
import json
from pathlib import Path
import subprocess
import sys


def run(directory):
    directory = Path(directory).resolve()
    for mode in ('demo', 'real'):
        home = directory / mode
        command = [sys.executable, str(Path(__file__).with_name('main.py')),
                   '--ui-smoke', '--data-home', str(home)]
        if mode == 'demo':
            command.append('--demo')
        process = subprocess.run(command, timeout=90, check=False)
        report = json.loads((home / 'native-report.json').read_text(encoding='utf-8'))
        if process.returncode or not report['passed']:
            raise AssertionError(report)
        print(mode + ': ' + str(len(report['checks'])) + ' native checks passed')
    return 0


if __name__ == '__main__':
    raise SystemExit(run(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).parent.parent / 'qa-native'))
