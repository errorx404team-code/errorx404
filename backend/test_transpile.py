import sys, os
sys.path.insert(0, '.')
from app.pipeline.mumps_transpiler.transpiler import MumpsTranspiler

source = open('../patient_check.m', encoding='utf-8').read()
t = MumpsTranspiler()
r = t.convert(source, target_language='Python')
print('SUCCESS:', r.is_valid)
print('ERRORS:', r.errors)
code = r.python_code
code = code.encode('ascii', errors='replace').decode('ascii')
print('=== GENERATED CODE ===')
print(code)
print('=== END ===')
