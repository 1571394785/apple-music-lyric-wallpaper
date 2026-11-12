import { cp, readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'dist');
const target = 'E:/SteamLibrary/steamapps/common/wallpaper_engine/projects/myprojects/index';
await mkdir(target, { recursive: true });
const builtProject = JSON.parse(await readFile(path.join(source, 'project.json'), 'utf8'));
let project;
try {
    project = JSON.parse(await readFile(path.join(target, 'project.json'), 'utf8'));
} catch (error) {
    if (error.code !== 'ENOENT') throw error;
    project = builtProject;
}
project.general ??= {};
project.general.properties ??= {};
for (const [key, value] of Object.entries(builtProject.general.properties)) {
    // Retain the installed wallpaper's saved defaults, metadata and workshop identity.
    project.general.properties[key] ??= value;
    // Display rules are schema updates, while the installed property's value stays intact.
    if (value.condition !== undefined) project.general.properties[key].condition = value.condition;
}
project.general.supportsaudioprocessing = true;
project.general.supportsmediaintegration = true;
for (const entry of await readdir(source)) {
    if (entry === 'project.json') continue;
    await cp(path.join(source, entry), path.join(target, entry), { recursive: true, force: true });
}
await writeFile(path.join(target, 'project.json'), JSON.stringify(project, null, 2) + '\n');
let checked = 0;
async function verify(directory, relative = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const name = path.join(relative, entry.name);
        if (entry.isDirectory()) await verify(path.join(directory, entry.name), name);
        else if (name !== 'project.json') {
            const hash = bytes => createHash('sha256').update(bytes).digest('hex');
            const [a, b] = await Promise.all([
                readFile(path.join(source, name)), readFile(path.join(target, name)),
            ]);
            if (hash(a) !== hash(b)) throw new Error(`Copy verification failed: ${name}`);
            checked++;
        }
    }
}
await verify(source);
console.log(`Copied and verified ${checked} files: ${target}`);
console.log(`Lyric size default: ${project.general.properties.lyricsize.value}%`);
