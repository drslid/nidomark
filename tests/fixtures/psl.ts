import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPublicSuffixList } from '../../lib/psl';

const HERE = path.dirname(fileURLToPath(import.meta.url));
loadPublicSuffixList(fs.readFileSync(path.join(HERE, '..', '..', 'lib', 'data', 'public_suffix_list.dat'), 'utf8'));
