#!/usr/bin/env python3

from pathlib import Path
import runpy

runpy.run_path(str(Path(__file__).parents[2] / 'healthy-fitness-coach' / 'scripts' / 'extract-style.py'), run_name='__main__')
