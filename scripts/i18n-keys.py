#!/usr/bin/env python3
# Rebuild startos/i18n/dictionaries/default.ts from every i18n('…') string used in startos/ (English only for now;
# the numbers are rewritten, so run it before any translation exists or keep the existing numbers by hand).
#   python3 scripts/i18n-keys.py
import glob, re
keys = []
for f in sorted(glob.glob('startos/**/*.ts', recursive=True)):
    if '/i18n/' in f:
        continue
    for m in re.finditer(r"i18n\(\s*'((?:[^'\\]|\\.)*)'", open(f, encoding='utf-8').read()):
        if m.group(1) not in keys:
            keys.append(m.group(1))
out = ["export const DEFAULT_LANG = 'en_US'", '', 'const dict = {']
out += ["  '%s': %d," % (k, i) for i, k in enumerate(keys)]
out += ['} as const', '', '/**', ' * Plumbing. DO NOT EDIT.', ' */', 'export type I18nKey = keyof typeof dict',
        'export type LangDict = Record<(typeof dict)[I18nKey], string>', 'export default dict', '']
open('startos/i18n/dictionaries/default.ts', 'w', encoding='utf-8').write('\n'.join(out))
print(len(keys), 'keys')
